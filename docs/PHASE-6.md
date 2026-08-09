# Aura Video AI — Phase 6

## Product Import & AI Product Intelligence

### Flow

```
URL | Image | Text
  → Safe extraction / AI analysis
  → Product record (DB)
  → ProductIntelligence (facts vs marketing)
  → Hooks
  → Create-video workflow (strategy → script → storyboard → templates)
  → Video Studio
```

### URL extraction

- SSRF protection, no auto-redirect follow, timeout, size limit, HTML-only
- JSON-LD, OpenGraph, meta tags, images, price/currency/brand when present
- `GenericHTMLProductAdapter` + platform detection (shopify, amazon, etc.)
- Architecture-ready for specialized adapters; never returns fake product data

### Product intelligence

Structured output validated with Zod:

- ProductProfile (facts/features)
- MarketingProfile (benefits, pain points — inferred)
- AudienceProfile
- MarketingAngles
- ContentRecommendations

### One-click video

`POST /api/v1/products/:id/create-video` runs Creative Engine pipeline and returns strategy, script, storyboard, template recommendations.

### API

| Method | Path |
|--------|------|
| GET | `/api/v1/products` |
| GET | `/api/v1/products/:id` |
| DELETE | `/api/v1/products/:id` |
| POST | `/api/v1/products/import/url` |
| POST | `/api/v1/products/import/text` |
| POST | `/api/v1/products/import/image` |
| GET | `/api/v1/products/:id/intelligence` |
| POST | `/api/v1/products/:id/hooks` |
| POST | `/api/v1/products/:id/create-video` |

### Credits

Configurable via `PRODUCT_ANALYSIS_ENABLED_BILLING` + `PRODUCT_ANALYSIS_CREDITS` (default off / 0).

### Web

- `/products/import` — tabs URL / Image / Description + intelligence UI + Create Video
- `/products` — library (list, create video, delete)

### Security

Auth, rate limits, SSRF, Zod, server-side AI keys only.
