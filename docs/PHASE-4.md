# Aura Video AI — Phase 4

## Real AI Video Production Engine

### Pipeline

```
Product Input → Analysis → Strategy → Script → Storyboard
  → Template → Media Provider (text/image-to-video)
  → Async Job → Poll → Compose (FFmpeg) → Storage → Asset
```

### Provider architecture

`IMediaGenerationProvider`:

- `capabilities()`, `isConfigured()`, `supportsMode()`
- `generateVideo()` — text-to-video / image-to-video
- `getJobStatus()`, `cancelJob?()`

Implemented adapter: **OpenAIMediaProvider** (OpenAI-compatible `/videos` API).

Without `MEDIA_API_KEY`: `VIDEO_PROVIDER_NOT_CONFIGURED` (no fake jobs).

### Job lifecycle

Statuses: `queued` → `processing` → `composing` → `rendering` → `completed` | `failed` | `canceled`

Fields: provider, providerJobId, progress, currentStage, creditsCharged, idempotencyKey, outputUrl, assetId.

HTTP `POST /video/generate` returns `{ jobId, status, creditsCharged }` immediately.
Background `setImmediate` + optional Redis list `aura:video:jobs`.

### Composition

`VideoCompositionService` uses **FFmpeg** to normalize/concat scene clips and burn optional text.
Does not return provider URLs as the final product without storage persist.

### Credits

`CreditLedgerService.estimateCost` + atomic SQL deduct (`balance >= amount`).
Refund on provider failure / cancel / timeout.
No double-charge on polling (deduct once at create; idempotency key reuses job).

### API

| Method | Path |
|--------|------|
| POST | `/api/v1/video/generate` |
| POST | `/api/v1/video/estimate` |
| GET | `/api/v1/video/jobs/:jobId` |
| POST | `/api/v1/video/jobs/:jobId/cancel` |

### Web

`/video` — Video Studio (full pipeline UI + polling + download).

### Env

```
MEDIA_PROVIDER=openai
MEDIA_API_KEY=
MEDIA_BASE_URL=
MEDIA_VIDEO_MODEL=sora-2
VIDEO_MAX_DURATION=60
VIDEO_MAX_SCENES=20
```

### Errors

`VIDEO_PROVIDER_NOT_CONFIGURED`, `VIDEO_PROVIDER_UNAVAILABLE`, `VIDEO_GENERATION_FAILED`,
`VIDEO_GENERATION_TIMEOUT`, `VIDEO_OUTPUT_INVALID`, `VIDEO_STORAGE_FAILED`,
`INSUFFICIENT_CREDITS`, `INVALID_VIDEO_INPUT`
