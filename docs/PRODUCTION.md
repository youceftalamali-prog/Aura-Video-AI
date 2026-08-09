# Aura Video AI — Production Notes

## Required services
- PostgreSQL 16+
- Redis 7+
- Node 20+ / pnpm 9+
- FFmpeg (installed in `docker/Dockerfile.api` production image)

## Quick start
```bash
cp .env.example .env
# fill secrets: JWT, DATABASE_URL, REDIS_URL, AI keys, PayPal, optional R2
pnpm install
pnpm db:push
pnpm dev
```

Docker infra:
```bash
cd docker && docker compose up -d postgres redis
# optional: docker compose up --build api
```

## Storage
- `STORAGE_PROVIDER=local` (default for first run)
- `STORAGE_PROVIDER=r2` uses AWS SDK v3 against Cloudflare R2 (real SigV4)

## Billing
Active provider: **PayPal**. Stripe code is dormant.

## Customer path
Product → AI → Creative → Script → Storyboard → Template → Video → FFmpeg → Storage → Preview → Download MP4 → Library
No automatic social posting on this path.
