# Staging deployment: Google Cloud Run + Neon PostgreSQL

This runbook is for a **separate staging deployment** of Aura Video AI. It does not replace, update, or migrate the existing Cloud Run services.

## Architecture

- API: build from `docker/Dockerfile.api` (Node 20, FFmpeg included).
- Video worker: use the same API image, with command `node dist/worker.js`.
- Web UI: build from `docker/Dockerfile.web`, setting build arg `VITE_API_URL` to the staging API URL.
- Database: a dedicated Neon project/database for Aura Video AI.
- Redis: a separate managed Redis-compatible service is required; Neon does not replace Redis.
- Object storage: use Cloudflare R2 (or another S3-compatible provider) for generated media. Do not rely on local container storage for production videos because Cloud Run instances are disposable.

## Before deploying

1. Create new Cloud Run staging service names; do not edit the existing production services.
2. Create a dedicated Redis instance and bucket for staging.
3. Store credentials in Google Secret Manager, not in Git or image build arguments.
4. Set all required environment variables from `.env.example` and `packages/config/src/env.ts`. At minimum:
   - `NODE_ENV=production`
   - `PORT=8080` for Cloud Run API service (Cloud Run provides this variable; ensure the process listens on it)
   - `DATABASE_URL` (pooled Neon URL for the long-running API/worker)
   - `REDIS_URL` and `REDIS_PREFIX=aura:staging:`
   - `JWT_SECRET` (random secret at least 32 characters)
   - `CORS_ORIGINS`, `WEB_URL`, `API_URL` set to staging URLs
   - `STORAGE_PROVIDER=r2`, plus `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, and any required public URL setting
   - AI/TTS/media provider keys only for providers that are configured and implemented
   - PayPal sandbox credentials until billing is explicitly validated
5. Confirm the API health endpoint and worker startup/logs before routing users to staging.

## Database connection and migrations

- In Neon Console, select the Aura Video AI project's `production` branch, database and role, then use **Connect**.
- Use the pooled URL (hostname includes `-pooler`) as runtime `DATABASE_URL` for API and worker.
- Use the direct, non-pooled Neon URL for one-off migrations when possible. Keep both values in Secret Manager; never commit either URL.
- Inspect the target database and confirm it is the dedicated Aura Video AI database. Do not point migrations at SunVera Jolie.
- Run migrations once as a controlled, one-off task/job, not from every API instance:
  ```bash
  pnpm --filter @aura/api db:migrate
  ```
  Run from the repository root with the migration job's `DATABASE_URL` configured to the direct Neon URL.
- Drizzle migration SQL files and a journal exist under `apps/api/drizzle`. Validate that every journal entry has a matching SQL file, then run migrations against staging before considering the app ready.

## Container build references

Run from the repository root after Docker is authenticated to the target Artifact Registry. Replace placeholders with the actual Google Cloud project, region, repository, and immutable commit tag.

API image:
```bash
docker build -f docker/Dockerfile.api -t REGION-docker.pkg.dev/PROJECT_ID/aura-staging/api:COMMIT_SHA .
docker push REGION-docker.pkg.dev/PROJECT_ID/aura-staging/api:COMMIT_SHA
```

Web image (replace the API URL with the actual staging API URL):
```bash
docker build -f docker/Dockerfile.web --build-arg VITE_API_URL=https://STAGING_API_URL -t REGION-docker.pkg.dev/PROJECT_ID/aura-staging/web:COMMIT_SHA .
docker push REGION-docker.pkg.dev/PROJECT_ID/aura-staging/web:COMMIT_SHA
```

Deploy the API, worker, and web as separate staging services. The worker should use the API image with command `node dist/worker.js`; do not expose it as a public HTTP service. Confirm the built web bundle uses the staging API URL before deploying.

## Staging acceptance checks

- API starts and health endpoint returns HTTP 200.
- API connects to Neon and reports database health.
- Redis ping succeeds.
- Worker starts and consumes a test job.
- A test user can sign in, import a product, generate an output, and download the MP4.
- Generated media persists after a new Cloud Run revision.
- Billing remains sandbox-only until PayPal checkout and webhook are verified.
- Existing production Cloud Run services remain unchanged.

## Known deployment blockers to resolve

- Select and configure a managed Redis provider.
- Configure durable object storage and credentials.
- Confirm the exact health endpoint and web app API base URL configuration.
- Validate Docker builds and all migrations in a staging environment; source inspection alone does not prove a successful deployment.
