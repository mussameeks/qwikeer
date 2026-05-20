-- ============================================================
-- QWIKEER TRADING ENGINE RPC
-- Migration: 002_qwikeer_trading_engine_rpc.sql
--
-- Purpose:
-- - Order placement
-- - Matching engine
-- - Order cancellation
-- - Complete set minting
-- - Market resolution
-- - Safe market cancellation
-- - Demo balance credit
--
-- Important:
-- - This file assumes 001_qwikeer_core_schema.sql has already run.
-- - Keep this file as project source of truth.
-- - Do not run against production without backup.
-- ============================================================

-- ============================================================
-- COMPATIBILITY PATCH FOR ORDERS TABLE
-- ============================================================
-- Current app code expects:
-- - quantity
-- - filled_quantity
-- - remaining_quantity
--
-- Some earlier schemas used original_quantity only.
-- This patch makes the table compatible with the app.

alter table public.orders
add column if not exists quantity bigint;

alter table public.orders
add column if not exists filled_quantity bigint not null default 0;

update public.orders
set quantity = coalesce(quantity, original_quantity, remaining_quantity, 0)
where quantity is null;

alter table public.orders
alter column quantity set not null;

alter table public.orders
drop constraint if exists orders_quantity_check;

alter table public.orders
add constraint orders_quantity_check
check (quantity > 0);

alter table public.orders
drop constraint if exists orders_filled_quantity_check;

alter table public.orders
add constraint orders_filled_quantity_check
check (filled_quantity >= 0);

-- ============================================================
-- CREDIT DEMO BALANCE
-- ============================================================

create or replace function public.credit_demo_balance(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_amount_cents bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
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

  if p_amount_cents <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  perform public.ensure_wallet(p_target_user_id);

  update public.wallets
  set available_cents = available_cents + p_amount_cents
  where user_id = p_target_user_id;

  perform public.write_ledger(
    p_target_user_id,
    'admin_credit',
    p_amount_cents,
    null,
    'Demo/testing balance credited by admin'
  );

  return jsonb_build_object(
    'success', true,
    'target_user_id', p_target_user_id,
    'amount_cents', p_amount_cents
  );
end;
$$;

-- ============================================================
-- MINT COMPLETE SETS
-- ============================================================

create or replace function public.mint_complete_sets(
  p_user_id uuid,
  p_market_id uuid,
  p_quantity bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_outcome public.outcomes%rowtype;
  v_cost_cents bigint;
  v_outcome_count int;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if p_market_id is null then
    raise exception 'Market is required';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select *
  into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_market.status <> 'open' then
    raise exception 'Market must be open to mint complete sets';
  end if;

  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'Market is closed';
  end if;

  select count(*)
  into v_outcome_count
  from public.outcomes
  where market_id = p_market_id;

  if v_outcome_count < 2 then
    raise exception 'Market must have at least two outcomes';
  end if;

  perform public.ensure_wallet(p_user_id);

  v_cost_cents := p_quantity * 100;

  update public.wallets
  set available_cents = available_cents - v_cost_cents
  where user_id = p_user_id
    and available_cents >= v_cost_cents;

  if not found then
    raise exception 'Insufficient available balance';
  end if;

  perform public.write_ledger(
    p_user_id,
    'mint',
    -v_cost_cents,
    p_market_id,
    'Minted complete YES/NO sets'
  );

  for v_outcome in
    select *
    from public.outcomes
    where market_id = p_market_id
  loop
    perform public.ensure_position(p_user_id, p_market_id, v_outcome.id);

    update public.positions
    set available_quantity = available_quantity + p_quantity
    where user_id = p_user_id
      and market_id = p_market_id
      and outcome_id = v_outcome.id;
  end loop;

  return jsonb_build_object(
    'success', true,
    'market_id', p_market_id,
    'quantity', p_quantity,
    'cost_cents', v_cost_cents
  );
end;
$$;

-- ============================================================
-- PLACE ORDER + MATCHING ENGINE
-- ============================================================

create or replace function public.place_order(
  p_user_id uuid,
  p_market_id uuid,
  p_outcome_id uuid,
  p_side order_side,
  p_price_cents int,
  p_quantity bigint,
  p_client_order_id text default null
)
returns setof public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_market public.markets%rowtype;
  v_outcome public.outcomes%rowtype;
  v_new_order public.orders%rowtype;
  v_maker_order public.orders%rowtype;

  v_trade_quantity bigint;
  v_trade_price_cents int;
  v_cash_lock_cents bigint;
  v_refund_cents bigint;
begin
  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if p_market_id is null then
    raise exception 'Market is required';
  end if;

  if p_outcome_id is null then
    raise exception 'Outcome is required';
  end if;

  if p_price_cents < 1 or p_price_cents > 99 then
    raise exception 'Price must be between 1 and 99 cents';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select *
  into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_market.status <> 'open' then
    raise exception 'Market must be open for trading';
  end if;

  if v_market.closes_at is not null and v_market.closes_at <= now() then
    raise exception 'Market is closed';
  end if;

  select *
  into v_outcome
  from public.outcomes
  where id = p_outcome_id
    and market_id = p_market_id;

  if not found then
    raise exception 'Selected outcome not found';
  end if;

  perform public.ensure_wallet(p_user_id);

  if p_side = 'buy' then
    v_cash_lock_cents := p_price_cents * p_quantity;

    update public.wallets
    set available_cents = available_cents - v_cash_lock_cents,
        locked_cents = locked_cents + v_cash_lock_cents
    where user_id = p_user_id
      and available_cents >= v_cash_lock_cents;

    if not found then
      raise exception 'Insufficient available balance';
    end if;

    perform public.write_ledger(
      p_user_id,
      'order_lock',
      -v_cash_lock_cents,
      null,
      'Locked cash for buy order'
    );
  else
    perform public.ensure_position(p_user_id, p_market_id, p_outcome_id);

    update public.positions
    set available_quantity = available_quantity - p_quantity,
        locked_quantity = locked_quantity + p_quantity
    where user_id = p_user_id
      and market_id = p_market_id
      and outcome_id = p_outcome_id
      and available_quantity >= p_quantity;

    if not found then
      raise exception 'Insufficient available shares';
    end if;
  end if;

  insert into public.orders (
    user_id,
    market_id,
    outcome_id,
    side,
    price_cents,
    original_quantity,
    quantity,
    filled_quantity,
    remaining_quantity,
    status,
    client_order_id
  )
  values (
    p_user_id,
    p_market_id,
    p_outcome_id,
    p_side,
    p_price_cents,
    p_quantity,
    p_quantity,
    0,
    p_quantity,
    'open',
    p_client_order_id
  )
  returning * into v_new_order;

  -- ==========================================================
  -- MATCH NEW BUY AGAINST OPEN SELL ORDERS
  -- ==========================================================

  if p_side = 'buy' then
    for v_maker_order in
      select *
      from public.orders
      where market_id = p_market_id
        and outcome_id = p_outcome_id
        and side = 'sell'
        and status in ('open', 'partial')
        and remaining_quantity > 0
        and price_cents <= p_price_cents
        and user_id <> p_user_id
      order by price_cents asc, created_at asc
      for update
    loop
      exit when v_new_order.remaining_quantity <= 0;

      v_trade_quantity := least(
        v_new_order.remaining_quantity,
        v_maker_order.remaining_quantity
      );

      v_trade_price_cents := v_maker_order.price_cents;

      insert into public.trades (
        market_id,
        outcome_id,
        buy_order_id,
        sell_order_id,
        buyer_user_id,
        seller_user_id,
        price_cents,
        quantity
      )
      values (
        p_market_id,
        p_outcome_id,
        v_new_order.id,
        v_maker_order.id,
        p_user_id,
        v_maker_order.user_id,
        v_trade_price_cents,
        v_trade_quantity
      );

      -- Buyer: consume locked cash at original bid price.
      update public.wallets
      set locked_cents = locked_cents - (p_price_cents * v_trade_quantity)
      where user_id = p_user_id
        and locked_cents >= (p_price_cents * v_trade_quantity);

      -- Buyer price improvement refund.
      v_refund_cents := (p_price_cents - v_trade_price_cents) * v_trade_quantity;

      if v_refund_cents > 0 then
        update public.wallets
        set available_cents = available_cents + v_refund_cents
        where user_id = p_user_id;

        perform public.write_ledger(
          p_user_id,
          'order_unlock',
          v_refund_cents,
          v_new_order.id,
          'Buy order price improvement refund'
        );
      end if;

      perform public.ensure_position(p_user_id, p_market_id, p_outcome_id);

      update public.positions
      set available_quantity = available_quantity + v_trade_quantity
      where user_id = p_user_id
        and market_id = p_market_id
        and outcome_id = p_outcome_id;

      -- Seller: release locked shares and receive cash.
      update public.positions
      set locked_quantity = locked_quantity - v_trade_quantity
      where user_id = v_maker_order.user_id
        and market_id = p_market_id
        and outcome_id = p_outcome_id
        and locked_quantity >= v_trade_quantity;

      update public.wallets
      set available_cents = available_cents + (v_trade_price_cents * v_trade_quantity)
      where user_id = v_maker_order.user_id;

      perform public.write_ledger(
        v_maker_order.user_id,
        'trade_sell',
        v_trade_price_cents * v_trade_quantity,
        v_maker_order.id,
        'Sold shares'
      );

      update public.orders
      set filled_quantity = filled_quantity + v_trade_quantity,
          remaining_quantity = remaining_quantity - v_trade_quantity,
          status = case
            when remaining_quantity - v_trade_quantity = 0 then 'filled'::order_status
            else 'partial'::order_status
          end
      where id = v_maker_order.id;

      update public.orders
      set filled_quantity = filled_quantity + v_trade_quantity,
          remaining_quantity = remaining_quantity - v_trade_quantity,
          status = case
            when remaining_quantity - v_trade_quantity = 0 then 'filled'::order_status
            else 'partial'::order_status
          end
      where id = v_new_order.id
      returning * into v_new_order;
    end loop;
  end if;

  -- ==========================================================
  -- MATCH NEW SELL AGAINST OPEN BUY ORDERS
  -- ==========================================================

  if p_side = 'sell' then
    for v_maker_order in
      select *
      from public.orders
      where market_id = p_market_id
        and outcome_id = p_outcome_id
        and side = 'buy'
        and status in ('open', 'partial')
        and remaining_quantity > 0
        and price_cents >= p_price_cents
        and user_id <> p_user_id
      order by price_cents desc, created_at asc
      for update
    loop
      exit when v_new_order.remaining_quantity <= 0;

      v_trade_quantity := least(
        v_new_order.remaining_quantity,
        v_maker_order.remaining_quantity
      );

      v_trade_price_cents := v_maker_order.price_cents;

      insert into public.trades (
        market_id,
        outcome_id,
        buy_order_id,
        sell_order_id,
        buyer_user_id,
        seller_user_id,
        price_cents,
        quantity
      )
      values (
        p_market_id,
        p_outcome_id,
        v_maker_order.id,
        v_new_order.id,
        v_maker_order.user_id,
        p_user_id,
        v_trade_price_cents,
        v_trade_quantity
      );

      -- Buyer: consume locked cash and receive shares.
      update public.wallets
      set locked_cents = locked_cents - (v_trade_price_cents * v_trade_quantity)
      where user_id = v_maker_order.user_id
        and locked_cents >= (v_trade_price_cents * v_trade_quantity);

      perform public.ensure_position(v_maker_order.user_id, p_market_id, p_outcome_id);

      update public.positions
      set available_quantity = available_quantity + v_trade_quantity
      where user_id = v_maker_order.user_id
        and market_id = p_market_id
        and outcome_id = p_outcome_id;

      -- Seller: release locked shares and receive cash.
      update public.positions
      set locked_quantity = locked_quantity - v_trade_quantity
      where user_id = p_user_id
        and market_id = p_market_id
        and outcome_id = p_outcome_id
        and locked_quantity >= v_trade_quantity;

      update public.wallets
      set available_cents = available_cents + (v_trade_price_cents * v_trade_quantity)
      where user_id = p_user_id;

      perform public.write_ledger(
        p_user_id,
        'trade_sell',
        v_trade_price_cents * v_trade_quantity,
        v_new_order.id,
        'Sold shares'
      );

      update public.orders
      set filled_quantity = filled_quantity + v_trade_quantity,
          remaining_quantity = remaining_quantity - v_trade_quantity,
          status = case
            when remaining_quantity - v_trade_quantity = 0 then 'filled'::order_status
            else 'partial'::order_status
          end
      where id = v_maker_order.id;

      update public.orders
      set filled_quantity = filled_quantity + v_trade_quantity,
          remaining_quantity = remaining_quantity - v_trade_quantity,
          status = case
            when remaining_quantity - v_trade_quantity = 0 then 'filled'::order_status
            else 'partial'::order_status
          end
      where id = v_new_order.id
      returning * into v_new_order;
    end loop;
  end if;

  return query
  select *
  from public.orders
  where id = v_new_order.id;
end;
$$;

-- ============================================================
-- CANCEL ORDER
-- ============================================================

create or replace function public.cancel_order(
  p_user_id uuid,
  p_order_id uuid
)
returns setof public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_refund_cents bigint;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status not in ('open', 'partial') then
    raise exception 'Only open or partial orders can be cancelled';
  end if;

  if v_order.remaining_quantity <= 0 then
    raise exception 'Order has no remaining quantity';
  end if;

  if v_order.side = 'buy' then
    v_refund_cents := v_order.remaining_quantity * v_order.price_cents;

    update public.wallets
    set locked_cents = locked_cents - v_refund_cents,
        available_cents = available_cents + v_refund_cents
    where user_id = p_user_id
      and locked_cents >= v_refund_cents;

    if not found then
      raise exception 'Locked balance error';
    end if;

    perform public.write_ledger(
      p_user_id,
      'order_unlock',
      v_refund_cents,
      v_order.id,
      'Cancelled buy order and unlocked cash'
    );
  else
    update public.positions
    set locked_quantity = locked_quantity - v_order.remaining_quantity,
        available_quantity = available_quantity + v_order.remaining_quantity
    where user_id = p_user_id
      and market_id = v_order.market_id
      and outcome_id = v_order.outcome_id
      and locked_quantity >= v_order.remaining_quantity;

    if not found then
      raise exception 'Locked shares error';
    end if;
  end if;

  update public.orders
  set status = 'cancelled',
      remaining_quantity = 0
  where id = v_order.id;

  return query
  select *
  from public.orders
  where id = v_order.id;
end;
$$;

-- ============================================================
-- RESOLVE MARKET
-- ============================================================

create or replace function public.resolve_market(
  p_admin_user_id uuid,
  p_market_id uuid,
  p_winning_outcome_id uuid,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_market public.markets%rowtype;
  v_outcome public.outcomes%rowtype;
  v_order public.orders%rowtype;
  v_position public.positions%rowtype;

  v_refund_cents bigint;
  v_position_quantity bigint;
  v_payout_cents bigint;

  v_total_payout_cents bigint := 0;
  v_total_refund_cents bigint := 0;
  v_cancelled_orders bigint := 0;
  v_paid_positions bigint := 0;
begin
  select exists (
    select 1
    from public.market_admins
    where user_id = p_admin_user_id
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Not authorized to resolve markets';
  end if;

  select *
  into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_market.status = 'resolved' then
    raise exception 'Market already resolved';
  end if;

  if v_market.status = 'cancelled' then
    raise exception 'Cancelled markets cannot be resolved';
  end if;

  select *
  into v_outcome
  from public.outcomes
  where id = p_winning_outcome_id
    and market_id = p_market_id;

  if not found then
    raise exception 'Winning outcome does not belong to this market';
  end if;

  -- Cancel open/partial orders and unlock resources.
  for v_order in
    select *
    from public.orders
    where market_id = p_market_id
      and status in ('open', 'partial')
      and remaining_quantity > 0
    for update
  loop
    if v_order.side = 'buy' then
      v_refund_cents := v_order.remaining_quantity * v_order.price_cents;

      update public.wallets
      set locked_cents = locked_cents - v_refund_cents,
          available_cents = available_cents + v_refund_cents
      where user_id = v_order.user_id
        and locked_cents >= v_refund_cents;

      v_total_refund_cents := v_total_refund_cents + v_refund_cents;

      perform public.write_ledger(
        v_order.user_id,
        'market_refund',
        v_refund_cents,
        v_order.id,
        'Refunded open buy order after market resolution'
      );
    else
      update public.positions
      set locked_quantity = locked_quantity - v_order.remaining_quantity,
          available_quantity = available_quantity + v_order.remaining_quantity
      where user_id = v_order.user_id
        and market_id = v_order.market_id
        and outcome_id = v_order.outcome_id
        and locked_quantity >= v_order.remaining_quantity;
    end if;

    update public.orders
    set status = 'cancelled',
        remaining_quantity = 0
    where id = v_order.id;

    v_cancelled_orders := v_cancelled_orders + 1;
  end loop;

  -- Pay winning positions.
  for v_position in
    select *
    from public.positions
    where market_id = p_market_id
      and (available_quantity > 0 or locked_quantity > 0)
    for update
  loop
    v_position_quantity :=
      v_position.available_quantity + v_position.locked_quantity;

    if v_position.outcome_id = p_winning_outcome_id then
      v_payout_cents := v_position_quantity * 100;

      if v_payout_cents > 0 then
        perform public.ensure_wallet(v_position.user_id);

        update public.wallets
        set available_cents = available_cents + v_payout_cents
        where user_id = v_position.user_id;

        perform public.write_ledger(
          v_position.user_id,
          'payout',
          v_payout_cents,
          p_market_id,
          'Market resolved payout'
        );

        v_total_payout_cents := v_total_payout_cents + v_payout_cents;
        v_paid_positions := v_paid_positions + 1;
      end if;
    end if;

    update public.positions
    set available_quantity = 0,
        locked_quantity = 0
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'resolved',
      resolved_outcome_id = p_winning_outcome_id,
      resolution_note = nullif(trim(coalesce(p_resolution_note, '')), '')
  where id = p_market_id;

  return jsonb_build_object(
    'success', true,
    'market_id', p_market_id,
    'winning_outcome_id', p_winning_outcome_id,
    'total_payout_cents', v_total_payout_cents,
    'total_refund_cents', v_total_refund_cents,
    'cancelled_orders', v_cancelled_orders,
    'paid_positions', v_paid_positions
  );
end;
$$;

-- ============================================================
-- SAFE CANCEL MARKET
-- ============================================================

create or replace function public.cancel_market(
  p_admin_user_id uuid,
  p_market_id uuid,
  p_cancel_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_market public.markets%rowtype;
  v_trades_count bigint;
  v_order public.orders%rowtype;
  v_position public.positions%rowtype;

  v_refund_cents bigint;
  v_position_quantity bigint;

  v_total_order_refunds bigint := 0;
  v_total_position_refunds bigint := 0;
  v_cancelled_orders bigint := 0;
  v_refunded_positions bigint := 0;
begin
  select exists (
    select 1
    from public.market_admins
    where user_id = p_admin_user_id
  )
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Not authorized to cancel markets';
  end if;

  select *
  into v_market
  from public.markets
  where id = p_market_id
  for update;

  if not found then
    raise exception 'Market not found';
  end if;

  if v_market.status = 'resolved' then
    raise exception 'Resolved markets cannot be cancelled';
  end if;

  if v_market.status = 'cancelled' then
    raise exception 'Market already cancelled';
  end if;

  select count(*)
  into v_trades_count
  from public.trades
  where market_id = p_market_id;

  if v_trades_count > 0 then
    raise exception 'This safe cancellation flow does not cancel markets with trades yet';
  end if;

  for v_order in
    select *
    from public.orders
    where market_id = p_market_id
      and status in ('open', 'partial')
    for update
  loop
    if v_order.side = 'buy' then
      v_refund_cents := v_order.remaining_quantity * v_order.price_cents;

      update public.wallets
      set locked_cents = locked_cents - v_refund_cents,
          available_cents = available_cents + v_refund_cents
      where user_id = v_order.user_id
        and locked_cents >= v_refund_cents;

      v_total_order_refunds := v_total_order_refunds + v_refund_cents;

      perform public.write_ledger(
        v_order.user_id,
        'market_refund',
        v_refund_cents,
        v_order.id,
        'Refunded open buy order after market cancellation'
      );
    end if;

    update public.orders
    set status = 'cancelled',
        remaining_quantity = 0
    where id = v_order.id;

    v_cancelled_orders := v_cancelled_orders + 1;
  end loop;

  -- In this safe no-trade cancellation flow, refund YES/NO shares at 50¢ each.
  for v_position in
    select *
    from public.positions
    where market_id = p_market_id
      and (available_quantity > 0 or locked_quantity > 0)
    for update
  loop
    perform public.ensure_wallet(v_position.user_id);

    v_position_quantity :=
      v_position.available_quantity + v_position.locked_quantity;

    v_refund_cents := v_position_quantity * 50;

    if v_refund_cents > 0 then
      update public.wallets
      set available_cents = available_cents + v_refund_cents
      where user_id = v_position.user_id;

      v_total_position_refunds := v_total_position_refunds + v_refund_cents;
      v_refunded_positions := v_refunded_positions + 1;

      perform public.write_ledger(
        v_position.user_id,
        'market_refund',
        v_refund_cents,
        p_market_id,
        'Refunded YES/NO shares at 50 cents after market cancellation'
      );
    end if;

    update public.positions
    set available_quantity = 0,
        locked_quantity = 0
    where id = v_position.id;
  end loop;

  update public.markets
  set status = 'cancelled',
      resolution_note = coalesce(nullif(trim(coalesce(p_cancel_note, '')), ''), 'Market cancelled')
  where id = p_market_id;

  return jsonb_build_object(
    'success', true,
    'market_id', p_market_id,
    'status', 'cancelled',
    'cancelled_orders', v_cancelled_orders,
    'refunded_positions', v_refunded_positions,
    'total_order_refunds_cents', v_total_order_refunds,
    'total_position_refunds_cents', v_total_position_refunds
  );
end;
$$;

-- ============================================================
-- RPC PERMISSIONS
-- ============================================================

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