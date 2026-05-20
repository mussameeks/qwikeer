# Qwikeer Security Checklist

## Auth Rules

- [ ] All protected API routes verify the user with `getApiUser(req)`.
- [ ] No protected route trusts `user_id` from URL query params.
- [ ] No protected route trusts `user_id` from request body.
- [ ] Admin routes verify `public.market_admins`.
- [ ] Admin status is never trusted from frontend state.

## Database Rules

- [ ] RLS is enabled on all public tables.
- [ ] `wallets` can only be read by the owner.
- [ ] `positions` can only be read by the owner.
- [ ] `orders` can only be read by the owner.
- [ ] `ledger_entries` can only be read by the owner.
- [ ] `markets`, `outcomes`, and `trades` are public-readable.
- [ ] Sensitive RPC functions are revoked from `anon` and `authenticated`.
- [ ] Sensitive RPC functions are callable only through server routes using service role.

## Money Movement Rules

- [ ] Wallet balances are never updated from frontend.
- [ ] Position quantities are never updated from frontend.
- [ ] Orders are placed only through `/api/orders`.
- [ ] Orders are cancelled only through `/api/orders/cancel`.
- [ ] Complete sets are minted only through `/api/complete-sets`.
- [ ] Market resolution is done only through `/api/admin/resolve-market`.
- [ ] Market cancellation is done only through `/api/admin/cancel-market`.
- [ ] Every wallet movement creates a ledger entry.

## Admin Rules

- [ ] Admin can create markets.
- [ ] Admin can edit unresolved markets.
- [ ] Admin can delete draft markets only.
- [ ] Admin can resolve markets.
- [ ] Admin can safely cancel no-trade markets.
- [ ] Admin liquidity tool is development-only.
- [ ] Admin demo credit is development-only.

## Production Before Launch

- [ ] Remove or protect demo balance credit route.
- [ ] Remove or protect admin liquidity route.
- [ ] Add KYC before real deposits.
- [ ] Add withdrawal approval flow.
- [ ] Add rate limiting.
- [ ] Add audit logs for admin actions.
- [ ] Add Terms of Use and Privacy Policy.
- [ ] Add responsible trading warnings.
- [ ] Add error monitoring.
- [ ] Add backup/restore procedure.