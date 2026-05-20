-- ============================================================
-- QWIKEER SECURITY HARDENING
-- Migration: 004_qwikeer_security_hardening.sql
--
-- Purpose:
-- - Final RLS enablement
-- - Final public read policies
-- - Final user-owned read policies
-- - Final RPC execute permissions
-- - Database sanity check views/functions for admin review
--
-- Important:
-- - Assumes migrations 001, 002, 003 have already run.
-- - Keep as source of truth.
-- - Do not run against production without backup.
-- ============================================================

-- ============================================================
-- RLS ENABLEMENT
-- ============================================================

alter table if exists public.market_admins enable row level security;
alter table if exists public.markets enable row level security;
alter table if exists public.outcomes enable row level security;
alter table if exists public.wallets enable row level security;
alter table if exists public.ledger_entries enable row level security;
alter table if exists public.positions enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.trades enable row level security;
alter table if exists public.money_requests enable row level security;
alter table if exists public.user_profiles enable row level security;
alter table if exists public.admin_audit_logs enable row level security;

-- ============================================================
-- PUBLIC READ POLICIES
-- ============================================================

drop policy if exists "Markets are publicly readable" on public.markets;
create policy "Markets are publicly readable"
on public.markets
for select
to anon, authenticated
using (true);

drop policy if exists "Outcomes are publicly readable" on public.outcomes;
create policy "Outcomes are publicly readable"
on public.outcomes
for select
to anon, authenticated
using (true);

drop policy if exists "Trades are publicly readable" on public.trades;
create policy "Trades are publicly readable"
on public.trades
for select
to anon, authenticated
using (true);

-- ============================================================
-- USER-OWNED READ POLICIES
-- ============================================================

drop policy if exists "Admins can read own admin record" on public.market_admins;
create policy "Admins can read own admin record"
on public.market_admins
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own wallet" on public.wallets;
create policy "Users read own wallet"
on public.wallets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own ledger" on public.ledger_entries;
create policy "Users read own ledger"
on public.ledger_entries
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own positions" on public.positions;
create policy "Users read own positions"
on public.positions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders"
on public.orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own money requests" on public.money_requests;
create policy "Users read own money requests"
on public.money_requests
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users read own profile" on public.user_profiles;
create policy "Users read own profile"
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- IMPORTANT:
-- No direct browser policies for writes
--
-- These tables should not have anon/authenticated insert/update/delete
-- policies:
--
-- wallets
-- ledger_entries
-- positions
-- orders
-- trades
-- money_requests
-- user_profiles admin fields
-- admin_audit_logs
--
-- Sensitive writes should go through Next.js API routes using service role,
-- then secure RPC functions.
-- ============================================================

-- ============================================================
-- FINAL RPC PERMISSIONS
-- ============================================================

-- Core helper RPCs
revoke execute on function public.ensure_wallet(uuid)
from anon, authenticated;

revoke execute on function public.ensure_position(uuid, uuid, uuid)
from anon, authenticated;

revoke execute on function public.write_ledger(uuid, ledger_type, bigint, uuid, text)
from anon, authenticated;

grant execute on function public.ensure_wallet(uuid)
to service_role;

grant execute on function public.ensure_position(uuid, uuid, uuid)
to service_role;

grant execute on function public.write_ledger(uuid, ledger_type, bigint, uuid, text)
to service_role;

-- Trading engine RPCs
revoke execute on function public.credit_demo_balance(uuid, uuid, bigint)
from anon, authenticated;

revoke execute on function public.mint_complete_sets(uuid, uuid, bigint)
from anon, authenticated;

revoke execute on function public.place_order(uuid, uuid, uuid, order_side, int, bigint, text)
from anon, authenticated;

revoke execute on function public.cancel_order(uuid, uuid)
from anon, authenticated;

revoke execute on function public.resolve_market(uuid, uuid, uuid, text)
from anon, authenticated;

revoke execute on function public.cancel_market(uuid, uuid, text)
from anon, authenticated;

grant execute on function public.credit_demo_balance(uuid, uuid, bigint)
to service_role;

grant execute on function public.mint_complete_sets(uuid, uuid, bigint)
to service_role;

grant execute on function public.place_order(uuid, uuid, uuid, order_side, int, bigint, text)
to service_role;

grant execute on function public.cancel_order(uuid, uuid)
to service_role;

grant execute on function public.resolve_market(uuid, uuid, uuid, text)
to service_role;

grant execute on function public.cancel_market(uuid, uuid, text)
to service_role;

-- Money / KYC / Audit RPCs
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

-- ============================================================
-- EXTRA INDEXES FOR PRODUCTION PERFORMANCE
-- ============================================================

create index if not exists idx_markets_status_created
on public.markets (status, created_at desc);

create index if not exists idx_markets_category_status
on public.markets (category, status);

create index if not exists idx_orders_market_outcome_side_status_price
on public.orders (market_id, outcome_id, side, status, price_cents);

create index if not exists idx_orders_user_status_created
on public.orders (user_id, status, created_at desc);

create index if not exists idx_positions_user_market
on public.positions (user_id, market_id);

create index if not exists idx_money_requests_type_status_created
on public.money_requests (type, status, created_at desc);

create index if not exists idx_user_profiles_email
on public.user_profiles (email);

-- ============================================================
-- DATABASE HEALTH CHECK FUNCTION
-- ============================================================
-- This is admin/server-useful. It does not expose secrets.
-- Can be called via service role from /api/admin/environment later.
-- ============================================================

create or replace function public.qwikeer_database_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required_tables text[] := array[
    'market_admins',
    'markets',
    'outcomes',
    'wallets',
    'ledger_entries',
    'positions',
    'orders',
    'trades',
    'money_requests',
    'user_profiles',
    'admin_audit_logs'
  ];

  v_table_name text;
  v_missing_tables text[] := array[]::text[];
  v_rls_disabled text[] := array[]::text[];

  v_required_functions text[] := array[
    'ensure_wallet',
    'ensure_position',
    'write_ledger',
    'credit_demo_balance',
    'mint_complete_sets',
    'place_order',
    'cancel_order',
    'resolve_market',
    'cancel_market',
    'ensure_user_profile',
    'update_own_profile',
    'admin_update_user_profile',
    'create_money_request',
    'cancel_money_request',
    'review_money_request',
    'write_admin_audit_log'
  ];

  v_function_name text;
  v_missing_functions text[] := array[]::text[];
begin
  -- Check required tables.
  foreach v_table_name in array v_required_tables
  loop
    if not exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = v_table_name
    ) then
      v_missing_tables := array_append(v_missing_tables, v_table_name);
    end if;
  end loop;

  -- Check RLS status.
  foreach v_table_name in array v_required_tables
  loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = v_table_name
    ) then
      if exists (
        select 1
        from pg_tables
        where schemaname = 'public'
          and tablename = v_table_name
          and rowsecurity = false
      ) then
        v_rls_disabled := array_append(v_rls_disabled, v_table_name);
      end if;
    end if;
  end loop;

  -- Check required function names exist.
  foreach v_function_name in array v_required_functions
  loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = v_function_name
    ) then
      v_missing_functions := array_append(v_missing_functions, v_function_name);
    end if;
  end loop;

  return jsonb_build_object(
    'ok',
      array_length(v_missing_tables, 1) is null
      and array_length(v_rls_disabled, 1) is null
      and array_length(v_missing_functions, 1) is null,

    'missing_tables',
      coalesce(to_jsonb(v_missing_tables), '[]'::jsonb),

    'rls_disabled_tables',
      coalesce(to_jsonb(v_rls_disabled), '[]'::jsonb),

    'missing_functions',
      coalesce(to_jsonb(v_missing_functions), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.qwikeer_database_health_check()
from anon, authenticated;

grant execute on function public.qwikeer_database_health_check()
to service_role;