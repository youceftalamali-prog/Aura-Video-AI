# Aura Video AI

Enterprise SaaS for AI-powered advertising video generation.

## Status
**Phases 1–13 implemented; Phase 14 final production hardening added.**

The repository is statically hardened and ready for the infrastructure readiness gate.
Live runtime/provider verification still requires the configured PostgreSQL, Redis, storage,
PayPal, AI, video-provider, and FFmpeg services.

### Customer path
Product → AI Analysis → Creative → Script → Storyboard → Template → Video Generation → FFmpeg → Storage → Preview → Download MP4 → Library

- **Billing:** PayPal active
- **Stripe:** dormant (not used for active billing)
- **Social:** no automatic posting on the customer path
- **Preview / Download:** 0 credits

## Stack
Node 20+, pnpm 9, TypeScript, Express, React/Vite, PostgreSQL, Redis, FFmpeg, Cloudflare R2 (optional)

## Quick start
```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
# Postgres + Redis: cd docker && docker compose up -d postgres redis
pnpm db:migrate
pnpm dev
```

Final readiness checks:
```bash
pnpm --filter @aura/api test:production
pnpm --filter @aura/api test:billing
pnpm --filter @aura/api test:paypal
pnpm --filter @aura/api test:library
```

See `docs/PRODUCTION.md`, `docs/PHASE-*.md`, and `docs/FINAL-PRODUCTION-AUDIT.md`.
