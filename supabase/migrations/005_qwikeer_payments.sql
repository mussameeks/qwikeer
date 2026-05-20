-- ============================================================
-- QWIKEER PAYMENTS
-- Migration: 005_qwikeer_payments.sql
--
-- Purpose:
-- - Provider-neutral payment transactions
-- - Flutterwave-ready deposit flow
-- - Idempotent wallet credit after verified payment
--
-- Important:
-- - Assumes 001, 002, 003, 004 have already run.
-- - Wallet credit must happen only after server-side verification.
-- ============================================================

do $$ begin
  create type payment_provider as enum (
    'flutterwave',
    'manual',
    'stripe',
    'paypal',
    'crypto'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_transaction_type as enum (
    'deposit',
    'withdrawal'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_transaction_status as enum (
    'pending',
    'processing',
    'successful',
    'failed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  money_request_id uuid references public.money_requests(id) on delete set null,

  provider payment_provider not null,
  type payment_transaction_type not null,

  status payment_transaction_status not null default 'pending',

  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD',

  provider_reference text not null,
  provider_transaction_id text,

  checkout_url text,

  provider_init_response jsonb not null default '{}'::jsonb,
  provider_verify_response jsonb not null default '{}'::jsonb,

  failure_reason text,

  credited_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, provider_reference)
);

create index if not exists idx_payment_transactions_user_created
on public.payment_transactions (user_id, created_at desc);

create index if not exists idx_payment_transactions_status_created
on public.payment_transactions (status, created_at desc);

create index if not exists idx_payment_transactions_provider_txid
on public.payment_transactions (provider, provider_transaction_id);

drop trigger if exists trg_payment_transactions_updated_at on public.payment_transactions;
create trigger trg_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at();

alter table public.payment_transactions enable row level security;

drop policy if exists "Users read own payment transactions" on public.payment_transactions;
create policy "Users read own payment transactions"
on public.payment_transactions
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- MARK PAYMENT AS PROCESSING
-- ============================================================

create or replace function public.mark_payment_transaction_processing(
  p_payment_transaction_id uuid,
  p_checkout_url text,
  p_provider_init_response jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.payment_transactions%rowtype;
begin
  update public.payment_transactions
  set status = 'processing',
      checkout_url = nullif(trim(coalesce(p_checkout_url, '')), ''),
      provider_init_response = coalesce(p_provider_init_response, '{}'::jsonb)
  where id = p_payment_transaction_id
    and status = 'pending'
  returning * into v_transaction;

  if not found then
    raise exception 'Payment transaction not found or not pending';
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_transaction_id', v_transaction.id,
    'status', v_transaction.status,
    'checkout_url', v_transaction.checkout_url
  );
end;
$$;

-- ============================================================
-- MARK PAYMENT FAILED
-- ============================================================

create or replace function public.mark_payment_transaction_failed(
  p_payment_transaction_id uuid,
  p_failure_reason text,
  p_provider_verify_response jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.payment_transactions%rowtype;
begin
  update public.payment_transactions
  set status = 'failed',
      failure_reason = nullif(trim(coalesce(p_failure_reason, '')), ''),
      provider_verify_response = coalesce(p_provider_verify_response, '{}'::jsonb)
  where id = p_payment_transaction_id
    and status in ('pending', 'processing')
  returning * into v_transaction;

  if not found then
    raise exception 'Payment transaction not found or cannot be failed';
  end if;

  if v_transaction.money_request_id is not null then
    update public.money_requests
    set status = 'rejected',
        admin_note = coalesce(p_failure_reason, 'Payment failed')
    where id = v_transaction.money_request_id
      and status = 'pending';
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_transaction_id', v_transaction.id,
    'status', v_transaction.status
  );
end;
$$;

-- ============================================================
-- PROCESS SUCCESSFUL PAYMENT DEPOSIT
-- ============================================================
-- Idempotent:
-- - If transaction already successful/credited, returns safely.
-- - Credits wallet once.
-- - Approves linked money_request.
-- - Writes ledger once through deposit ledger entry.
-- ============================================================

create or replace function public.process_successful_payment_deposit(
  p_provider payment_provider,
  p_provider_reference text,
  p_provider_transaction_id text,
  p_provider_verify_response jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction public.payment_transactions%rowtype;
begin
  if p_provider_reference is null or trim(p_provider_reference) = '' then
    raise exception 'Provider reference is required';
  end if;

  select *
  into v_transaction
  from public.payment_transactions
  where provider = p_provider
    and provider_reference = p_provider_reference
  for update;

  if not found then
    raise exception 'Payment transaction not found';
  end if;

  if v_transaction.type <> 'deposit' then
    raise exception 'Only deposit transactions can be processed here';
  end if;

  if v_transaction.status = 'successful' and v_transaction.credited_at is not null then
    return jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_transaction_id', v_transaction.id,
      'status', v_transaction.status
    );
  end if;

  if v_transaction.status not in ('pending', 'processing') then
    raise exception 'Payment transaction is not processable';
  end if;

  perform public.ensure_wallet(v_transaction.user_id);

  update public.wallets
  set available_cents = available_cents + v_transaction.amount_cents
  where user_id = v_transaction.user_id;

  perform public.write_ledger(
    v_transaction.user_id,
    'deposit',
    v_transaction.amount_cents,
    v_transaction.id,
    'Card deposit verified and credited'
  );

  update public.payment_transactions
  set status = 'successful',
      provider_transaction_id = nullif(trim(coalesce(p_provider_transaction_id, '')), ''),
      provider_verify_response = coalesce(p_provider_verify_response, '{}'::jsonb),
      credited_at = now()
  where id = v_transaction.id;

  if v_transaction.money_request_id is not null then
    update public.money_requests
    set status = 'approved',
        reviewed_at = now(),
        admin_note = 'Automatically approved after verified card payment'
    where id = v_transaction.money_request_id
      and status = 'pending';
  end if;

  return jsonb_build_object(
    'success', true,
    'already_processed', false,
    'payment_transaction_id', v_transaction.id,
    'user_id', v_transaction.user_id,
    'amount_cents', v_transaction.amount_cents,
    'status', 'successful'
  );
end;
$$;

-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke execute on function public.mark_payment_transaction_processing(uuid, text, jsonb)
from anon, authenticated;

revoke execute on function public.mark_payment_transaction_failed(uuid, text, jsonb)
from anon, authenticated;

revoke execute on function public.process_successful_payment_deposit(payment_provider, text, text, jsonb)
from anon, authenticated;

grant execute on function public.mark_payment_transaction_processing(uuid, text, jsonb)
to service_role;

grant execute on function public.mark_payment_transaction_failed(uuid, text, jsonb)
to service_role;

grant execute on function public.process_successful_payment_deposit(payment_provider, text, text, jsonb)
to service_role;