-- ============================================================
-- QWIKEER WEB3 WALLETS
-- Migration: 006_qwikeer_web3_wallets.sql
--
-- Purpose:
-- - Store embedded wallet / smart account addresses
-- - Prepare Qwikeer for Base / Base Sepolia
-- - Keep Web3 wallet records separate from old Web2 wallet table
-- ============================================================

do $$ begin
  create type web3_wallet_provider as enum (
    'privy',
    'dynamic',
    'magic',
    'external'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type web3_wallet_chain as enum (
    'base',
    'base_sepolia',
    'polygon',
    'arbitrum'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.web3_wallet_accounts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  provider web3_wallet_provider not null default 'privy',

  chain web3_wallet_chain not null default 'base_sepolia',

  embedded_wallet_address text,
  smart_account_address text,

  is_primary boolean not null default true,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, chain, provider)
);

create index if not exists idx_web3_wallet_accounts_user
on public.web3_wallet_accounts (user_id);

create index if not exists idx_web3_wallet_accounts_embedded_address
on public.web3_wallet_accounts (lower(embedded_wallet_address));

create index if not exists idx_web3_wallet_accounts_smart_account_address
on public.web3_wallet_accounts (lower(smart_account_address));

drop trigger if exists trg_web3_wallet_accounts_updated_at on public.web3_wallet_accounts;
create trigger trg_web3_wallet_accounts_updated_at
before update on public.web3_wallet_accounts
for each row execute function public.set_updated_at();

alter table public.web3_wallet_accounts enable row level security;

drop policy if exists "Users read own web3 wallet accounts" on public.web3_wallet_accounts;
create policy "Users read own web3 wallet accounts"
on public.web3_wallet_accounts
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- UPSERT WEB3 WALLET ACCOUNT
-- ============================================================

create or replace function public.upsert_web3_wallet_account(
  p_user_id uuid,
  p_provider web3_wallet_provider,
  p_chain web3_wallet_chain,
  p_embedded_wallet_address text,
  p_smart_account_address text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.web3_wallet_accounts%rowtype;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if p_embedded_wallet_address is null or trim(p_embedded_wallet_address) = '' then
    raise exception 'Embedded wallet address is required';
  end if;

  insert into public.web3_wallet_accounts (
    user_id,
    provider,
    chain,
    embedded_wallet_address,
    smart_account_address,
    is_primary,
    metadata
  )
  values (
    p_user_id,
    p_provider,
    p_chain,
    lower(trim(p_embedded_wallet_address)),
    nullif(lower(trim(coalesce(p_smart_account_address, ''))), ''),
    true,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (user_id, chain, provider)
  do update set
    embedded_wallet_address = excluded.embedded_wallet_address,
    smart_account_address = excluded.smart_account_address,
    metadata = excluded.metadata,
    is_primary = true
  returning * into v_wallet;

  return jsonb_build_object(
    'success', true,
    'wallet', jsonb_build_object(
      'id', v_wallet.id,
      'user_id', v_wallet.user_id,
      'provider', v_wallet.provider,
      'chain', v_wallet.chain,
      'embedded_wallet_address', v_wallet.embedded_wallet_address,
      'smart_account_address', v_wallet.smart_account_address,
      'is_primary', v_wallet.is_primary,
      'created_at', v_wallet.created_at,
      'updated_at', v_wallet.updated_at
    )
  );
end;
$$;

revoke execute on function public.upsert_web3_wallet_account(
  uuid,
  web3_wallet_provider,
  web3_wallet_chain,
  text,
  text,
  jsonb
)
from anon, authenticated;

grant execute on function public.upsert_web3_wallet_account(
  uuid,
  web3_wallet_provider,
  web3_wallet_chain,
  text,
  text,
  jsonb
)
to service_role;