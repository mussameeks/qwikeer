-- ============================================================
-- QWIKEER CORE SCHEMA
-- Migration: 001_qwikeer_core_schema.sql
--
-- Purpose:
-- - Core prediction market tables
-- - Wallets
-- - Ledger
-- - Orders
-- - Trades
-- - Positions
-- - Admin table
-- - Helper functions
--
-- Note:
-- - This file is safe to keep in your project as source of truth.
-- - Do not run against a working production DB without backup.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type order_side as enum ('buy', 'sell');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type order_status as enum (
    'open',
    'partial',
    'filled',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ledger_type as enum (
    'deposit',
    'withdrawal',
    'order_lock',
    'order_unlock',
    'trade_buy',
    'trade_sell',
    'mint',
    'payout',
    'market_refund',
    'admin_credit'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- UPDATED_AT HELPER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- ADMIN USERS
-- ============================================================

create table if not exists public.market_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.market_admins enable row level security;

drop policy if exists "Admins can read own admin record" on public.market_admins;
create policy "Admins can read own admin record"
on public.market_admins
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- MARKETS
-- ============================================================

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  category text not null default 'General',

  status text not null default 'draft'
    check (status in ('draft', 'open', 'paused', 'closed', 'resolved', 'cancelled')),

  closes_at timestamptz,

  resolved_outcome_id uuid,
  resolution_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_markets_updated_at on public.markets;
create trigger trg_markets_updated_at
before update on public.markets
for each row execute function public.set_updated_at();

alter table public.markets enable row level security;

drop policy if exists "Markets are publicly readable" on public.markets;
create policy "Markets are publicly readable"
on public.markets
for select
to anon, authenticated
using (true);

-- ============================================================
-- OUTCOMES
-- ============================================================

create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),

  market_id uuid not null references public.markets(id) on delete cascade,

  code text not null,
  name text not null,
  sort_order int not null default 0,

  created_at timestamptz not null default now(),

  unique (market_id, code)
);

create index if not exists idx_outcomes_market_id
on public.outcomes (market_id);

alter table public.outcomes enable row level security;

drop policy if exists "Outcomes are publicly readable" on public.outcomes;
create policy "Outcomes are publicly readable"
on public.outcomes
for select
to anon, authenticated
using (true);

alter table public.markets
drop constraint if exists markets_resolved_outcome_id_fkey;

alter table public.markets
add constraint markets_resolved_outcome_id_fkey
foreign key (resolved_outcome_id)
references public.outcomes(id)
on delete set null;

-- ============================================================
-- WALLETS
-- ============================================================

create table if not exists public.wallets (
  user_id uuid primary key,

  available_cents bigint not null default 0 check (available_cents >= 0),
  locked_cents bigint not null default 0 check (locked_cents >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_wallets_updated_at on public.wallets;
create trigger trg_wallets_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

alter table public.wallets enable row level security;

drop policy if exists "Users read own wallet" on public.wallets;
create policy "Users read own wallet"
on public.wallets
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- LEDGER
-- ============================================================

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  type ledger_type not null,

  amount_cents bigint not null,
  reference_id uuid,
  note text,

  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_entries_user_created
on public.ledger_entries (user_id, created_at desc);

alter table public.ledger_entries enable row level security;

drop policy if exists "Users read own ledger" on public.ledger_entries;
create policy "Users read own ledger"
on public.ledger_entries
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- POSITIONS
-- ============================================================

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id uuid not null references public.outcomes(id) on delete cascade,

  available_quantity bigint not null default 0 check (available_quantity >= 0),
  locked_quantity bigint not null default 0 check (locked_quantity >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, market_id, outcome_id)
);

create index if not exists idx_positions_user
on public.positions (user_id);

create index if not exists idx_positions_market
on public.positions (market_id);

drop trigger if exists trg_positions_updated_at on public.positions;
create trigger trg_positions_updated_at
before update on public.positions
for each row execute function public.set_updated_at();

alter table public.positions enable row level security;

drop policy if exists "Users read own positions" on public.positions;
create policy "Users read own positions"
on public.positions
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- ORDERS
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,
  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id uuid not null references public.outcomes(id) on delete cascade,

  side order_side not null,
  price_cents int not null check (price_cents >= 1 and price_cents <= 99),

  original_quantity bigint not null check (original_quantity > 0),
  remaining_quantity bigint not null check (remaining_quantity >= 0),

  status order_status not null default 'open',

  client_order_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user_created
on public.orders (user_id, created_at desc);

create index if not exists idx_orders_market_outcome_status
on public.orders (market_id, outcome_id, status);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

drop policy if exists "Users read own orders" on public.orders;
create policy "Users read own orders"
on public.orders
for select
to authenticated
using (auth.uid() = user_id);

-- ============================================================
-- TRADES
-- ============================================================

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),

  market_id uuid not null references public.markets(id) on delete cascade,
  outcome_id uuid not null references public.outcomes(id) on delete cascade,

  buy_order_id uuid references public.orders(id) on delete set null,
  sell_order_id uuid references public.orders(id) on delete set null,

  buyer_user_id uuid not null,
  seller_user_id uuid not null,

  price_cents int not null check (price_cents >= 1 and price_cents <= 99),
  quantity bigint not null check (quantity > 0),

  created_at timestamptz not null default now()
);

create index if not exists idx_trades_market_created
on public.trades (market_id, created_at desc);

create index if not exists idx_trades_outcome_created
on public.trades (outcome_id, created_at desc);

alter table public.trades enable row level security;

drop policy if exists "Trades are publicly readable" on public.trades;
create policy "Trades are publicly readable"
on public.trades
for select
to anon, authenticated
using (true);

-- ============================================================
-- HELPER RPC: ENSURE WALLET
-- ============================================================

create or replace function public.ensure_wallet(
  p_user_id uuid
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

  insert into public.wallets (user_id, available_cents, locked_cents)
  values (p_user_id, 0, 0)
  on conflict (user_id) do nothing;
end;
$$;

-- ============================================================
-- HELPER RPC: ENSURE POSITION
-- ============================================================

create or replace function public.ensure_position(
  p_user_id uuid,
  p_market_id uuid,
  p_outcome_id uuid
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

  insert into public.positions (
    user_id,
    market_id,
    outcome_id,
    available_quantity,
    locked_quantity
  )
  values (
    p_user_id,
    p_market_id,
    p_outcome_id,
    0,
    0
  )
  on conflict (user_id, market_id, outcome_id) do nothing;
end;
$$;

-- ============================================================
-- HELPER RPC: WRITE LEDGER
-- ============================================================

create or replace function public.write_ledger(
  p_user_id uuid,
  p_type ledger_type,
  p_amount_cents bigint,
  p_reference_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  insert into public.ledger_entries (
    user_id,
    type,
    amount_cents,
    reference_id,
    note
  )
  values (
    p_user_id,
    p_type,
    p_amount_cents,
    p_reference_id,
    p_note
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- RPC PERMISSIONS
-- ============================================================

revoke execute on function public.ensure_wallet(uuid) from anon, authenticated;
revoke execute on function public.ensure_position(uuid, uuid, uuid) from anon, authenticated;
revoke execute on function public.write_ledger(uuid, ledger_type, bigint, uuid, text) from anon, authenticated;

grant execute on function public.ensure_wallet(uuid) to service_role;
grant execute on function public.ensure_position(uuid, uuid, uuid) to service_role;
grant execute on function public.write_ledger(uuid, ledger_type, bigint, uuid, text) to service_role;