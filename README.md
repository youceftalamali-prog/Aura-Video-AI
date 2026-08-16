# Aura Video AI

Enterprise SaaS for AI-powered advertising video generation.

## Status
**Phases 1–13 implemented; Phases 14–20 production hardening, AI governance, Product Intelligence contract hardening, runtime readiness, project/video-asset integrity, credit-ledger verification, storage, and FFmpeg readiness added.**

The repository is statically hardened and now has repeatable infrastructure, output-integrity, credit-ledger, storage, and media-runtime readiness checks.
External provider verification still requires configured PostgreSQL, Redis, storage,
PayPal, AI, video-provider, and FFmpeg services.

### Customer path
Product → AI Analysis → Creative → Script → Storyboard → Template → Video Generation → FFmpeg → Storage → Preview → Download MP4 → Library

- **Billing:** PayPal active
- **Stripe:** dormant (not used for active billing)
- **Social:** no automatic posting on the customer path
- **Preview / Download:** 0 credits
- **Generated output:** canonical `projects.video_asset_id` relation with fresh signed URLs
- **Credits:** atomic wallet mutations with idempotent retries and bounded refunds
- **Media runtime:** local storage signing and FFmpeg smoke verification available

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
pnpm --filter @aura/api test:runtime
pnpm --filter @aura/api test:video-asset
pnpm --filter @aura/api test:credits
pnpm --filter @aura/api test:storage
pnpm --filter @aura/api test:production
pnpm --filter @aura/api test:ai-gateway
pnpm --filter @aura/api test:product-intelligence
pnpm --filter @aura/api test:billing
pnpm --filter @aura/api test:paypal
pnpm --filter @aura/api test:library
```

See `docs/PRODUCTION.md`, `docs/PHASE-*.md`, and `docs/FINAL-PRODUCTION-AUDIT.md`.
