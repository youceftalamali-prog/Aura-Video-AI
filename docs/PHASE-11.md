# Aura Video AI — Phase 11

## Credits, Billing Visibility & Workspace Settings

### Objective

Expose existing credit wallets, subscription records, and video job credit usage to users. Workspace rename. No fake payments.

### API `/api/v1/billing`

| Method | Path |
|--------|------|
| GET | `/overview` |
| GET | `/balance` |
| POST | `/estimate` |
| POST | `/top-up` → `BILLING_PROVIDER_NOT_CONFIGURED` without keys |
| GET/PATCH | `/workspace` |

### Credits

Uses existing `CreditLedgerService` for estimate and balance. Usage from `video_generation_jobs.credits_charged`. No second ledger.

### Database

None new.

### Frontend

`/billing` — balance, subscription, usage, top-up (structured failure), workspace name.
