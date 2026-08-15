# Aura Video AI — Phase 14

## Final production hardening and readiness gate

Phase 14 closes the static implementation cycle after the customer path in Phases 1–13.
It does not claim live provider verification without PostgreSQL, Redis, PayPal, storage,
AI, video-provider, and FFmpeg services.

### Implemented

- Bounded `X-Request-Id` generation and propagation for every API response.
- Request id included in server-side HTTP error logs for production correlation.
- A PostgreSQL partial unique index prevents concurrent active subscriptions for one workspace.
- Deterministic checks cover safe request-id acceptance, replacement of unsafe IDs, and UUID fallback.

### Required readiness commands

```bash
pnpm install --frozen-lockfile
pnpm --filter @aura/api test:production
pnpm --filter @aura/api test:billing
pnpm --filter @aura/api test:paypal
pnpm --filter @aura/api test:library
pnpm typecheck
pnpm build
pnpm db:migrate
```

### Runtime gate

The application is not `runtime verified` until the following are executed in an environment
with real services or controlled test doubles:

- PostgreSQL migrations and ownership/IDOR checks.
- Redis connectivity and recovery behavior.
- PayPal Sandbox checkout, capture, duplicate delivery, subscription activation, renewal, and cancellation.
- R2 or local signed storage upload, preview, export, expiry, and missing-object behavior.
- AI/video provider calls and FFmpeg composition.
- Full customer path: product → AI → creative → storyboard → video → storage → preview → download → Library.

Automatic social publishing remains outside this customer path.
