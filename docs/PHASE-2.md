# Aura Video AI — Phase 2

## AI Product Analysis + AI Assistant Foundation

### Architecture

```
apps/api/src/modules/ai/
  interfaces/     IAIProvider, IUrlMetadataExtractor
  providers/      OpenAIProvider, HtmlUrlMetadataExtractor
  services/       ProductAnalysisService, AIAssistantService
  dto/            Zod schemas
  controllers/    AIController
  routes/         /api/v1/ai/*
```

Clean flow:

```
Route → Controller → Application Service → Domain Interface → Infrastructure Provider
```

No business logic in controllers. Provider is swappable via `AI_PROVIDER` + `AI_API_KEY` / `AI_BASE_URL`.

### AI Provider Abstraction

`IAIProvider`:

- `analyzeText()`
- `analyzeProduct()`
- `generateStructuredOutput<T>()`
- `analyzeImage()` (optional, used for vision)

Default implementation: **OpenAI-compatible** HTTP client (`OpenAIProvider`).
Works with OpenAI or any compatible base URL.

Environment:

```
AI_PROVIDER=openai
AI_API_KEY=
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_VISION_MODEL=gpt-4o-mini
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.3
AI_TIMEOUT_MS=60000
AI_RATE_LIMIT_MAX=20
```

### Product Analysis Flow

1. **Text** → `ProductAnalysisService.analyzeFromText` → AI structured JSON
2. **URL** → `HtmlUrlMetadataExtractor` (meta/og tags only, SSRF-safe) → AI analysis
3. **Image** → Vision model + optional text context → AI analysis

Output validated by Zod `productAnalysisSchema`:

- productName, shortDescription, longDescription, category
- targetAudience, keyBenefits, features, sellingPoints, keywords
- brandTone, visualStyle, callToAction, suggestedAdAngles
- confidence, sourceType, sourceUrl, imageUrl

### API Endpoints

All require JWT authentication. Separate AI rate limit.

| Method | Path | Body |
|--------|------|------|
| POST | `/api/v1/ai/analyze-product-text` | `{ name, description, metadata? }` |
| POST | `/api/v1/ai/analyze-product-url` | `{ url }` |
| POST | `/api/v1/ai/analyze-product-image` | `{ imageUrl? \| imageBase64?, mimeType?, name?, description? }` |
| POST | `/api/v1/ai/assistant` | `{ message, productId?, productAnalysis?, language? }` |

#### Example — text analysis

```json
POST /api/v1/ai/analyze-product-text
{
  "name": "Aura Bottle",
  "description": "Insulated stainless steel bottle, 750ml, keeps drinks cold 24h."
}
```

#### Example — assistant

```json
POST /api/v1/ai/assistant
{
  "message": "أريد فيديو إعلاني احترافي لهذا المنتج",
  "productAnalysis": { ... }
}
```

Response includes detected `intent`, `recommendedNextStep`, and does **not** generate video.

### AI Intents

Defined for future phases:

`ANALYZE_PRODUCT`, `CREATE_PRODUCT_AD`, `CREATE_VIDEO`, `CREATE_IMAGE`, `SELECT_TEMPLATE`, `EDIT_AD`, `EXPORT_VIDEO`, `UNKNOWN`

Phase 2 implements detection + next-step guidance only.

### Security

- Auth required on all AI routes
- Zod validation + size limits
- Dedicated AI rate limiter
- URL allowlist: http/https only
- SSRF protections (private IPs, localhost blocked)
- No API keys in frontend
- Safe error messages (no secret leakage)

### Web

- Route: `/ai` — **AI Product Studio**
- Modes: Text / URL / Image
- Analysis result panel
- AI Assistant panel (intent detection, next step)
- Linked from Dashboard

### Database

No new tables. Phase 1 schema unchanged (10 tables).

### Future extension points

- Additional providers implementing `IAIProvider` (Anthropic, local models, etc.)
- Richer URL extractors behind `IUrlMetadataExtractor`
- Persist analysis snapshots on `products` / `projects` when product import lands
- Wire intents to template selection and video generation in later phases

### Out of scope (Phase 2)

Video generation, image generation, template library UI, credits deduction, billing.
