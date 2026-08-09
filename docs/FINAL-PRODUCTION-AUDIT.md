# Aura Video AI — Final Production Audit

**Date:** 2026-08-09  
**Scope:** Full monorepo forensic review (code-level). Runtime/provider live tests blocked without credentials/services.

## Executive Summary

| Verdict | Detail |
|---------|--------|
| **Code compile** | PASS (`pnpm typecheck`, `pnpm build`) |
| **Architecture** | Clean monorepo: apps (api/web/admin) + packages (types/sdk/ui/config/shared/i18n) |
| **Live E2E** | NOT VERIFIED / BLOCKED (no Postgres/Redis/PayPal/AI credentials in audit environment) |
| **Production deploy** | **CONDITIONALLY READY** after env setup + Sandbox billing test + provider keys |

The codebase is structured for production SaaS (auth, workspace isolation, credits atomicity, PayPal webhooks, AI/video abstractions, i18n). Several external dependencies cannot be proven live in this environment.

## Architecture (discovered)

```
User → apps/web (React/Vite)
     → apps/api (Express/TS)
         → PostgreSQL (Drizzle)
         → Redis (ioredis / health)
         → Storage (local | R2)
         → AI provider (OpenAI-compatible)
         → Video media provider + FFmpeg (Docker)
         → PayPal billing (active) / Stripe (dormant)
```

Modules: auth, dashboard, admin, ai, creative, video, studio, products, publishing, templates, library, billing.

## Database tables (schema.ts)

users, sessions, workspaces, settings, templates, assets, products, projects, subscriptions, credit_wallets, video_generation_jobs, paypal_webhook_events, stripe_webhook_events, social_connections, publishing_jobs (+ relations).

Migrations: `apps/api/src/db/migrate.ts` present.

## Auth

- bcrypt password hashing
- JWT access + refresh
- Google OAuth path present
- `requireAuth` middleware on protected routes
- Helmet + CORS + global rate limit
- Module-level rate limits (AI, creative, billing)

## Authorization

- Library/projects/assets: `findByIdForUser` / workspace-scoped services
- Billing: personal workspace by owner
- Credits: workspace wallet with atomic SQL deduct (`balance >= amount`)

## Credits

- Atomic deduct via conditional UPDATE
- Grant on PayPal activation/renewal/capture (webhook-verified only)
- Idempotent webhook events table

## PayPal

- Active provider; Stripe dormant and not wired in `createBillingModule`
- OAuth token cache, official webhook verification API
- Create subscription → approval URL; cancel via PayPal API
- Duplicate active sub blocked
- Live Sandbox: **BLOCKED** (no credentials)

## AI / Video

- Provider abstractions; media registry with DisabledMediaProvider for missing config
- Language directive in OpenAI provider path
- FFmpeg installed in `Dockerfile.api` — runtime **NOT VERIFIED** here
- Video jobs + storage persistence present in code

## i18n / RTL

- EN/FR/AR key parity: **338 / 338 / 338** (Missing 0)
- LanguageProvider + preferred_language persistence
- Logical Tailwind spacing preferred; brand name "Aura Video AI" allowed untranslated

## Security findings

### P0
- None confirmed in static review that block compile/deploy of the API binary itself.

### P1
1. **Local `/storage` static mount** — unauthenticated file access when `STORAGE_PROVIDER=local`. Hardened with `index:false`, `dotfiles:deny`. **Prefer R2 signed URLs in production.**
2. **CSP disabled** (`helmet({ contentSecurityPolicy: false })`) — acceptable for API-only but tighten if API serves pages.
3. **PayPal upgrade/downgrade** — not native; cancel+recreate only → mark **NOT SUPPORTED** safely.

### P2
1. Publishing module exists but product policy says no auto social publish for MVP — keep dormant in UX.
2. Music service requires uploaded licensed files (placeholder styles) — expected.
3. Helmet CSP off; cookie flags depend on deployment TLS termination.

### P3
1. Expand automated test suite beyond static typecheck.
2. Add DB partial unique index for one active subscription per workspace.
3. Structured request-id middleware end-to-end.

## What could not be verified

| System | Status | Reason |
|--------|--------|--------|
| PostgreSQL runtime | BLOCKED | No DB in audit env |
| Redis runtime | BLOCKED | No Redis in audit env |
| PayPal Sandbox | BLOCKED | No PAYPAL_* credentials |
| AI provider live | NOT VERIFIED | No AI_API_KEY |
| Video provider live | NOT VERIFIED | No media provider keys |
| FFmpeg runtime | NOT VERIFIED | No Docker daemon / binary test |
| R2 storage | NOT VERIFIED | No R2 credentials |
| E2E user journey | BLOCKED | Depends on all of the above |

## Build evidence

```
pnpm install --frozen-lockfile  → OK
pnpm typecheck                  → EXIT 0
pnpm build                      → EXIT 0
```

## Production deployment requirements

1. Set all secrets via env (never commit): JWT, DB, Redis, AI, PayPal, R2.
2. Run migrations against PostgreSQL.
3. `STORAGE_PROVIDER=r2` for production.
4. PayPal Sandbox full subscribe → webhook → credits → cancel before Live.
5. Docker image with FFmpeg for composition.
6. TLS termination + secure cookies in reverse proxy.

## Conclusion

**Codebase: production-capable (STATIC PASS).**  
**Live production: NOT VERIFIED until credentials and infrastructure are configured and Sandbox-tested.**
