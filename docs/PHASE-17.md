# Aura Video AI — Phase 17

## Runtime readiness gate

Phase 17 adds a repeatable execution gate for infrastructure that static checks cannot prove.

### Implemented

- Added a runtime harness for PostgreSQL connectivity.
- Added migration-table verification.
- Added required-schema verification for products, projects, assets, Product Intelligence, video jobs, billing, PayPal events, and AI provider configuration.
- Added Product Intelligence column verification for `version`, `status`, `intelligence`, and `error_code`.
- Added Redis PING and read/write/delete round-trip verification.
- Exposed the check through the API package scripts.

### Local command

```bash
pnpm --filter @aura/api test:runtime
```

The command requires a reachable environment with:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET (at least 32 characters)
```

Recommended local setup:

```bash
cp .env.example .env
# start PostgreSQL and Redis
pnpm db:migrate
pnpm --filter @aura/api test:runtime
```

### Verification scope

This gate proves local PostgreSQL, migrations, the expected schema, Redis connectivity, and a Redis round trip. It does not prove OpenRouter, PayPal Sandbox, R2, external media providers, or production credentials. Those integrations require separate credentialed tests.
