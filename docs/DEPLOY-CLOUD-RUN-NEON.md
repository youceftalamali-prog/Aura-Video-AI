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

1. Create a new Cloud Run staging service name; do not edit the existing production service.
2. Create a dedicated Redis instance and bucket for staging.
3. Store credentials in Google Secret Manager, not in Git or image build arguments.
4. Set all required environment variables from `.env.example` and `packages/config/src/env.ts`. At minimum:
   - `NODE_ENV=production`
   - `PORT=3001` for API (Cloud Run injects `PORT`; app must listen on it)
   - `DATABASE_URL` (pooled Neon URL for the long-running API/worker)
   - `REDIS_URL` and `REDIS_PREFIX=aura:staging:`
   - `JWT_SECRET` (random secret at least 32 characters)
   - `CORS_ORIGINS`, `WEB_URL`, `API_URL` set to staging URLs
   - `STORAGE_PROVIDER=r2`, plus the required `R2_* ` values
   - AI/TTS/media provider keys only for providers that are configured and implemented
   - PayPal sandbox credentials until billing is explicitly validated
5. Confirm the API's health endpoint and the worker's startup/logs before routing users to staging.

## Database connection and migrations

- In Neon Console, select the new Aura Video AI project's `production` branch, database and role, then use **Connect**.
- Use the pooled URL (hostname includes `-pooler`) as the runtime `DATABASE_URL` for API and worker.
- Use the direct, non-pooled Neon URL for one-off migrations when possible. Keep both values in Secret Manager; never commit either URL.
- First inspect the target database and confirm it is the dedicated, empty Aura Video AI database. Do not point migrations at SunVera Jolie.
- Run migrations once as a controlled, one-off task/job, not from every API instance:
  ```bash
  pnpm --filter @aura/api db:migrate
  ```
  Run from the repository root with the migration job's `DATABASE_URL` configured to the direct Neon URL.
- The repository currently includes Drizzle migration files under `apps/api/drizzle` and a journal. Validate that every journal entry has a matching SQL file and run the migration against staging before the app is considered ready.

## Container build references

API image:
```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/aura-staging/api:COMMIT_SHA --file docker/Dockerfile.api .
```

Web image (replace the API URL with the actual staging API URL):
```bash
gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/aura-staging/web:COMMIT_SHA --file docker/Dockerfile.web --substitutions=_VITE_API_URL=https://STAGING_API_URL .
```

Note: Cloud Build substitutions do not automatically become Docker build args. If using this web build command, configure the build to pass `VITE_API_URL` as a Docker build argument (or build locally with `docker build --build-arg VITE_API_URL=...`). Do not deploy until the built web bundle is verified to call the staging API.

## Staging acceptance checks

- API starts and health endpoint returns HTTP 200.
- API connects to Neon and reports database health.
- Redis ping succeeds.
- Worker starts and consumes a test job.
- Test user can sign in, import a product, generate an output, and download the MP4.
- Generated media persists after a new Cloud Run revision.
- Billing remains sandbox-only until PayPal webhook and checkout are verified.
- Existing production Cloud Run services remain unchanged.

## Known deployment blockers to resolve

- Select and configure a managed Redis provider.
- Configure a durable object-storage bucket and credentials.
- Confirm the exact health endpoint and the web app's API base URL configuration.
- Validate Docker builds and all migrations in a staging environment; source inspection alone does not prove a successful deployment.
