## Migration files

Recommended order:

```txt
001_qwikeer_core_schema.sql
002_qwikeer_trading_engine_rpc.sql
003_qwikeer_money_kyc_audit.sql
004_qwikeer_security_hardening.sql
## Security hardening

The final security migration is:

```txt
004_qwikeer_security_hardening.sql

---

## 3. Confirm file structure

```txt
supabase/
  migrations/
    001_qwikeer_core_schema.sql
    002_qwikeer_trading_engine_rpc.sql
    003_qwikeer_money_kyc_audit.sql