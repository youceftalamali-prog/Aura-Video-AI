# Aura Video AI — Phase 7

## Publishing & Distribution Engine

### Flow

```
Completed Video Asset
  → Validate (ownership, type, ready)
  → Select platform connection
  → Publish now | Schedule
  → Background process (upload via provider)
  → Status: published | failed
  → History / retry / cancel
```

### Tables

- `social_connections` — OAuth accounts (encrypted tokens at rest)
- `publishing_jobs` — async publish lifecycle + idempotency

### Providers

| Platform | Adapter | Notes |
|----------|---------|-------|
| YouTube | Real OAuth + resumable upload | Needs Google Cloud OAuth app |
| Facebook | OAuth + page context required | Clear error until Page linked |
| Instagram | OAuth + Business account required | Clear error until IG Business |
| TikTok | OAuth + publish init | App review may be required |

Missing credentials → `PLATFORM_NOT_CONFIGURED` (no fake success).

### Security

- AES-256-GCM via `TOKEN_ENCRYPTION_KEY`
- Tokens never returned to frontend
- Workspace isolation
- Idempotency keys
- Rate limiting

### API (`/api/v1/publishing`)

providers, connections (connect/callback/validate/delete), validate, publish, schedule, jobs (list/get/retry/cancel)

### Env

```
TOKEN_ENCRYPTION_KEY=
YOUTUBE_CLIENT_ID / SECRET / REDIRECT_URI
META_CLIENT_ID / SECRET / REDIRECT_URI
TIKTOK_CLIENT_KEY / SECRET / REDIRECT_URI
```

### Frontend

`/publishing` — accounts, platforms, publish form, jobs
