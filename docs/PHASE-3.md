# Aura Video AI — Phase 3

## Creative Engine + Video Generation Architecture

### Pipeline

```
Product → Product Analysis → Creative Strategy → Ad Script
  → Storyboard → Template Selection → Media Generation
  → Video Job → Asset
```

### Modules

```
apps/api/src/modules/creative/
  services/   CreativeStrategyService, AdScriptService, StoryboardService, TemplateService
  dto/        Zod schemas
  controllers/, routes/

apps/api/src/modules/video/
  interfaces/ IMediaGenerationProvider
  providers/  OpenAIMediaProvider (+ registry for fal/runway/kling/veo/google)
  services/   VideoGenerationService, VideoJobRepository
  controllers/, routes/
```

### API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/creative/strategy` | Creative strategy from ProductAnalysis |
| POST | `/api/v1/creative/script` | Ad script |
| POST | `/api/v1/creative/storyboard` | Storyboard |
| GET | `/api/v1/creative/templates` | List active templates |
| GET | `/api/v1/creative/templates/:id` | Get template |
| POST | `/api/v1/creative/recommend-template` | Deterministic ranking |
| POST | `/api/v1/video/generate` | Create async job → `{ jobId, status }` |
| GET | `/api/v1/video/jobs/:jobId` | Poll status (syncs provider) |
| POST | `/api/v1/video/jobs/:jobId/cancel` | Cancel |

### Template recommendation

Rule-based scoring (category, aspect ratio, duration, keywords, premium).
Not AI-only ranking.

### Media provider abstraction

`IMediaGenerationProvider`: `generateVideo`, `getJobStatus`, `cancelJob?`, `isConfigured`.

Registry via `MEDIA_PROVIDER`. Implemented: **OpenAI-compatible** provider.
If credentials missing → `MEDIA_PROVIDER_NOT_CONFIGURED` (no fake success).

### Video jobs

Table: `video_generation_jobs`

Statuses: `queued` | `processing` | `completed` | `failed` | `canceled`

Async: HTTP returns job id; status polled; on completion asset persisted via storage abstraction.

### Credits

No deduction in Phase 3. Consumption deferred.

### Security

Auth on all routes, project ownership checks, Zod limits (duration/scenes/prompt size),
rate limits, server-side provider keys only.

### Observability

Structured logs: `generation_requested`, `generation_submitted`, `generation_processing`,
`generation_completed`, `generation_failed`, `generation_canceled`.

### Web

`/creative` — Creative Studio workflow + video job polling (real status only).

### Env

```
MEDIA_PROVIDER=none|openai|fal|runway|kling|veo|google
MEDIA_API_KEY=
MEDIA_BASE_URL=
VIDEO_MAX_DURATION=60
VIDEO_MAX_SCENES=20
VIDEO_RATE_LIMIT_MAX=10
```
