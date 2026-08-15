# Aura Video AI — Phase 19

## Credit ledger runtime hardening

Phase 19 verifies and hardens credit mutations used by video generation, billing grants, refunds, and retries.

### Implemented

- Rejects zero, negative, fractional, and unsafe credit amounts.
- Rejects blank or oversized idempotency keys.
- Keeps wallet mutation and append-only ledger insertion inside one database transaction.
- Locks the wallet row so concurrent deductions cannot overspend the balance.
- Makes repeated grant, usage, and refund calls return the original mutation result without duplicate ledger rows.
- Rejects reuse of an idempotency key for a different operation or amount.
- Rejects deductions larger than the available balance.
- Rejects refunds larger than the workspace's net used credits.
- Added deterministic policy checks for cost calculation and mutation validation.
- Extended the Runtime Readiness Gate with a real PostgreSQL credit lifecycle using an ephemeral user/workspace and cleanup.

### Checks

Offline deterministic policy check:

```bash
pnpm --filter @aura/api test:credits
```

Database and Redis runtime check:

```bash
pnpm --filter @aura/api test:runtime
```

The runtime scenario creates temporary test records, verifies grants, deductions, refunds, retries, idempotency conflicts, insufficient balance, concurrent deductions, refund bounds, wallet counters, and ledger-row counts, then deletes the temporary records.

These checks require a reachable PostgreSQL instance with migrations applied and a reachable Redis instance. They are not considered passed until executed in that environment.
