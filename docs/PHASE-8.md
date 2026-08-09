# Aura Video AI — Phase 8

## AI Template Library & Dynamic Template Engine

### User flow

```
Dashboard (Ready-made templates)
  → /templates (categories)
  → /templates/:category (gallery)
  → /templates/view/:slug (preview + Use Template)
  → Select product (Phase 6)
  → POST /templates/:id/generate
  → Creative Engine (strategy → script → storyboard)
  → /video Studio
```

### Data

Extends existing `templates` table:

- slug, subCategory, isFeatured
- metadata.scenes, tags, supportedProductTypes, hasRealPreview

Seed catalog: jewelry, fashion, sportswear, shoes, beauty, watches (+ category definitions for bags, electronics, food, home, automotive, real-estate).

### API (`/api/v1/templates`)

| Method | Path |
|--------|------|
| GET | `/categories` |
| GET | `/categories/:category` |
| GET | `/` (filters: category, search, featured) |
| GET | `/:id` (id or slug) |
| POST | `/:id/instantiate` |
| POST | `/:id/generate` |

### Integration

Generate uses **existing** CreativeStrategyService, AdScriptService, StoryboardService and ProductService intelligence — no second video engine.

Preview videos: `hasRealPreview` distinguishes real assets vs placeholders (never fakes generation).

### Frontend

- Dashboard horizontal category strip
- `/templates`, `/templates/:category`, `/templates/view/:id`
