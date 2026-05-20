-- ============================================================
-- QWIKEER MONEY / KYC / AUDIT
-- Migration: 003_qwikeer_money_kyc_audit.sql
--
-- Purpose:
-- - Manual deposits / withdrawals
-- - User profile / KYC readiness
-- - Deposit and withdrawal limits
-- - Admin audit logs
--
-- Important:
-- - This file assumes:
--   001_qwikeer_core_schema.sql
--   002_qwikeer_trading_engine_rpc.sql
--   have already run.
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type money_request_type as enum (
    'deposit',
    'withdrawal'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type money_request_status as enum (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type verification_status as enum (
    'unverified',
    'pending',
    'verified',
    'rejected',
    'suspended'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type admin_audit_action as enum (
    'market_created',
    'market_updated',
    'market_deleted',
    'market_resolved',
    'market_cancelled',
    'deposit_approved',
    'deposit_rejected',
    'withdrawal_approved',
    'withdrawal_rejected',
    'demo_balance_credited',
    'liquidity_created',
    'user_profile_updated',
    'admin_action'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- USER PROFILES / KYC READINESS
-- ============================================================

create table if not exists public.user_profiles (
  user_id uuid primary key,

  email text,
  full_name text,
  phone_number text,
  country text default 'Rwanda',

  verification_status verification_status not null default 'unverified',

  deposit_limit_cents bigint not null default 0 check (deposit_limit_cents >= 0),
  withdrawal_limit_cents bigint not null default 0 check (withdrawal_limit_cents >= 0),

  admin_note text,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_verification_status
on public.user_profiles (verification_status);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists "Users read own profile" on public.user_profiles;
create policy "Users read own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- MONEY REQUESTS
-- ============================================================

create table if not exists public.money_requests (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  type money_request_type not null,
  status money_request_status not null default 'pending',

  amount_cents bigint not null check (amount_cents > 0),

  payment_method text,
  payment_reference text,
  account_name text,
  account_number text,
  user_note text,

  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_money_requests_user_created
on public.money_requests (user_id, created_at desc);

create index if not exists idx_money_requests_status_created
on public.money_requests (status, created_at desc);

drop trigger if exists trg_money_requests_updated_at on public.money_requests;
create trigger trg_money_requests_updated_at
before update on public.money_requests
for each row execute function public.set_updated_at();

alter table public.money_requests enable row level security;

drop policy if exists "Users read own money requests" on public.money_requests;
create policy "Users read own money requests"
on public.money_requests
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- ADMIN AUDIT LOGS
-- ============================================================

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),

  admin_user_id uuid not null,

  action admin_audit_action not null,

  target_type text,
  target_id uuid,

  summary text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_admin_created
on public.admin_audit_logs (admin_user_id, created_at desc);

create index if not exists idx_admin_audit_logs_action_created
on public.admin_audit_logs (action, created_at desc);

create index if not exists idx_admin_audit_logs_target
on public.admin_audit_logs (target_type, target_id);

alter table public.admin_audit_logs enable row level security;

-- Admin reads/writes are handled only through server API using service role.

-- ============================================================
-- ENSURE USER PROFILE
-- ============================================================

create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  insert into public.user_profiles (
    user_id,
    email,
    verification_status,
    deposit_limit_cents,
    withdrawal_limit_cents
  )
  values (
    p_user_id,
    p_email,
    'unverified',
    0,
    0
  )
  on conflict (user_id) do update
  set email = coalesce(public.user_profiles.email, excluded.email);
end;
$$;

-- ============================================================
-- USER UPDATES OWN PROFILE
-- ============================================================

create or replace function public.update_own_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone_number text,
  p_country text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  perform public.ensure_user_profile(p_user_id, null);

  update public.user_profiles
  set full_name = nullif(trim(coalesce(p_full_name, '')), ''),
      phone_number = nullif(trim(coalesce(p_phone_number, '')), ''),
      country = coalesce(nullif(trim(coalesce(p_country, '')), ''), 'Rwanda'),
      verification_status = case
        when verification_status = 'unverified' then 'pending'::verification_status
        else verification_status
      end
  where user_id = p_user_id
  returning * into v_profile;

  return jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id,
      'email', v_profile.email,
      'full_name', v_profile.full_name,
      'phone_number', v_profile.phone_number,
      'country', v_profile.country,
      'verification_status', v_profile.verification_status,
      'deposit_limit_cents', v_profile.deposit_limit_cents,
      'withdrawal_limit_cents', v_profile.withdrawal_limit_cents
    )
  );
end;
$$;

-- ============================================================
-- ADMIN UPDATES USER PROFILE
-- ============================================================

create or replace function public.admin_update_user_profile(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_verification_status verification_status,
  p_deposit_limit_cents bigint,
  p_withdrawal_limit_cents bigint,
  p_admin_note text default null,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_profile public.user_profiles%rowtype;
begin
  select exists (
    select 1
    from public.market_admins
    where user_id = p_admin_user_id
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Not authorized';
  end if;

  if p_target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if p_deposit_limit_cents < 0 or p_withdrawal_limit_cents < 0 then
    raise exception 'Limits cannot be negative';
  end if;

  perform public.ensure_user_profile(p_target_user_id, null);

  update public.user_profiles
  set verification_status = p_verification_status,
      deposit_limit_cents = p_deposit_limit_cents,
      withdrawal_limit_cents = p_withdrawal_limit_cents,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      rejection_reason = nullif(trim(coalesce(p_rejection_reason, '')), '')
  where user_id = p_target_user_id
  returning * into v_profile;

  return jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'user_id', v_profile.user_id,
      'email', v_profile.email,
      'full_name', v_profile.full_name,
      'phone_number', v_profile.phone_number,
      'country', v_profile.country,
      'verification_status', v_profile.verification_status,
      'deposit_limit_cents', v_profile.deposit_limit_cents,
      'withdrawal_limit_cents', v_profile.withdrawal_limit_cents,
      'admin_note', v_profile.admin_note,
      'rejection_reason', v_profile.rejection_reason
    )
  );
end;
$$;

-- ============================================================
-- CREATE MONEY REQUEST
-- ============================================================

create or replace function public.create_money_request(
  p_user_id uuid,
  p_type money_request_type,
  p_amount_cents bigint,
  p_payment_method text default null,
  p_payment_reference text default null,
  p_account_name text default null,
  p_account_number text default null,
  p_user_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.money_requests%rowtype;
  v_profile public.user_profiles%rowtype;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  perform public.ensure_wallet(p_user_id);
  perform public.ensure_user_profile(p_user_id, null);

  select *
  into v_profile
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_profile.verification_status = 'suspended' then
    raise exception 'Your account is suspended. Please contact support';
  end if;

  if v_profile.verification_status = 'rejected' then
    raise exception 'Your verification was rejected. Please update your profile or contact support';
  end if;

  if v_profile.verification_status = 'unverified' then
    raise exception 'Please complete your profile before creating money requests';
  end if;

  if p_type = 'deposit' then
    if v_profile.deposit_limit_cents <= 0 then
      raise exception 'Deposit limit is not enabled for your account yet';
    end if;

    if p_amount_cents > v_profile.deposit_limit_cents then
      raise exception 'Deposit amount exceeds your account deposit limit';
    end if;
  end if;

  if p_type = 'withdrawal' then
    if v_profile.verification_status <> 'verified' then
      raise exception 'Your account must be verified before withdrawals';
    end if;

    if v_profile.withdrawal_limit_cents <= 0 then
      raise exception 'Withdrawal limit is not enabled for your account yet';
    end if;

    if p_amount_cents > v_profile.withdrawal_limit_cents then
      raise exception 'Withdrawal amount exceeds your account withdrawal limit';
    end if;

    update public.wallets as w
    set available_cents = w.available_cents - p_amount_cents,
        locked_cents = w.locked_cents + p_amount_cents
    where w.user_id = p_user_id
      and w.available_cents >= p_amount_cents;

    if not found then
      raise exception 'Insufficient available balance';
    end if;

    perform public.write_ledger(
      p_user_id,
      'order_lock',
      -p_amount_cents,
      null,
      'Locked balance for pending withdrawal request'
    );
  end if;

  insert into public.money_requests (
    user_id,
    type,
    status,
    amount_cents,
    payment_method,
    payment_reference,
    account_name,
    account_number,
    user_note
  )
  values (
    p_user_id,
    p_type,
    'pending',
    p_amount_cents,
    nullif(trim(coalesce(p_payment_method, '')), ''),
    nullif(trim(coalesce(p_payment_reference, '')), ''),
    nullif(trim(coalesce(p_account_name, '')), ''),
    nullif(trim(coalesce(p_account_number, '')), ''),
    nullif(trim(coalesce(p_user_note, '')), '')
  )
  returning * into v_request;

  return jsonb_build_object(
    'success', true,
    'request_id', v_request.id,
    'type', v_request.type,
    'status', v_request.status,
    'amount_cents', v_request.amount_cents,
    'verification_status', v_profile.verification_status,
    'deposit_limit_cents', v_profile.deposit_limit_cents,
    'withdrawal_limit_cents', v_profile.withdrawal_limit_cents
  );
end;
$$;

-- ============================================================
-- CANCEL MONEY REQUEST
-- ============================================================

create or replace function public.cancel_money_request(
  p_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.money_requests%rowtype;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  select *
  into v_request
  from public.money_requests
  where id = p_request_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Only pending requests can be cancelled';
  end if;

  if v_request.type = 'withdrawal' then
    update public.wallets as w
    set locked_cents = w.locked_cents - v_request.amount_cents,
        available_cents = w.available_cents + v_request.amount_cents
    where w.user_id = p_user_id
      and w.locked_cents >= v_request.amount_cents;

    if not found then
      raise exception 'Locked balance error';
    end if;

    perform public.write_ledger(
      p_user_id,
      'order_unlock',
      v_request.amount_cents,
      v_request.id,
      'Unlocked balance after cancelling withdrawal request'
    );
  end if;

  update public.money_requests
  set status = 'cancelled'
  where id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'cancelled'
  );
end;
$$;

-- ============================================================
-- ADMIN REVIEW MONEY REQUEST
-- ============================================================

create or replace function public.review_money_request(
  p_admin_user_id uuid,
  p_request_id uuid,
  p_decision money_request_status,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_request public.money_requests%rowtype;
begin
  select exists (
    select 1
    from public.market_admins
    where user_id = p_admin_user_id
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Not authorized';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select *
  into v_request
  from public.money_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Only pending requests can be reviewed';
  end if;

  perform public.ensure_wallet(v_request.user_id);

  if v_request.type = 'deposit' then
    if p_decision = 'approved' then
      update public.wallets as w
      set available_cents = w.available_cents + v_request.amount_cents
      where w.user_id = v_request.user_id;

      perform public.write_ledger(
        v_request.user_id,
        'deposit',
        v_request.amount_cents,
        v_request.id,
        'Manual deposit approved'
      );
    end if;
  end if;

  if v_request.type = 'withdrawal' then
    if p_decision = 'approved' then
      update public.wallets as w
      set locked_cents = w.locked_cents - v_request.amount_cents
      where w.user_id = v_request.user_id
        and w.locked_cents >= v_request.amount_cents;

      if not found then
        raise exception 'Locked balance error';
      end if;

      perform public.write_ledger(
        v_request.user_id,
        'withdrawal',
        -v_request.amount_cents,
        v_request.id,
        'Manual withdrawal approved'
      );
    else
      update public.wallets as w
      set locked_cents = w.locked_cents - v_request.amount_cents,
          available_cents = w.available_cents + v_request.amount_cents
      where w.user_id = v_request.user_id
        and w.locked_cents >= v_request.amount_cents;

      if not found then
        raise exception 'Locked balance error';
      end if;

      perform public.write_ledger(
        v_request.user_id,
        'order_unlock',
        v_request.amount_cents,
        v_request.id,
        'Unlocked balance after withdrawal rejection'
      );
    end if;
  end if;

  update public.money_requests
  set status = p_decision,
      reviewed_by = p_admin_user_id,
      reviewed_at = now(),
      admin_note = nullif(trim(coalesce(p_admin_note, '')), '')
  where id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'decision', p_decision,
    'type', v_request.type,
    'amount_cents', v_request.amount_cents
  );
end;
$$;

-- ============================================================
-- WRITE ADMIN AUDIT LOG
-- ============================================================

create or replace function public.write_admin_audit_log(
  p_admin_user_id uuid,
  p_action admin_audit_action,
  p_target_type text default null,
  p_target_id uuid default null,
  p_summary text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_log_id uuid;
begin
  select exists (
    select 1
    from public.market_admins
    where user_id = p_admin_user_id
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Not authorized to write admin audit logs';
  end if;

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    summary,
    metadata
  )
  values (
    p_admin_user_id,
    p_action,
    nullif(trim(coalesce(p_target_type, '')), ''),
    p_target_id,
    nullif(trim(coalesce(p_summary, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

-- ============================================================
-- RPC PERMISSIONS
-- ============================================================

revoke execute on function public.ensure_user_profile(uuid, text)
from anon, authenticated;

revoke execute on function public.update_own_profile(uuid, text, text, text)
from anon, authenticated;

revoke execute on function public.admin_update_user_profile(uuid, uuid, verification_status, bigint, bigint, text, text)
from anon, authenticated;

revoke execute on function public.create_money_request(uuid, money_request_type, bigint, text, text, text, text, text)
from anon, authenticated;

revoke execute on function public.cancel_money_request(uuid, uuid)
from anon, authenticated;

revoke execute on function public.review_money_request(uuid, uuid, money_request_status, text)
from anon, authenticated;

revoke execute on function public.write_admin_audit_log(uuid, admin_audit_action, text, uuid, text, jsonb)
from anon, authenticated;

grant execute on function public.ensure_user_profile(uuid, text)
to service_role;

grant execute on function public.update_own_profile(uuid, text, text, text)
to service_role;

grant execute on function public.admin_update_user_profile(uuid, uuid, verification_status, bigint, bigint, text, text)
to service_role;

grant execute on function public.create_money_request(uuid, money_request_type, bigint, text, text, text, text, text)
to service_role;

grant execute on function public.cancel_money_request(uuid, uuid)
to service_role;

grant execute on function public.review_money_request(uuid, uuid, money_request_status, text)
to service_role;

grant execute on function public.write_admin_audit_log(uuid, admin_audit_action, text, uuid, text, jsonb)
to service_role;