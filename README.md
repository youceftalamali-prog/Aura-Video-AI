# Aura Video AI

Enterprise SaaS for AI-powered advertising video generation.

## Status
**Phases 1–13 implemented.**

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
pnpm db:push
pnpm dev
```

See `docs/PRODUCTION.md` and `docs/PHASE-*.md`.
