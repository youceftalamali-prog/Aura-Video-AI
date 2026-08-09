# Aura Video AI — Phase 9

## Template Experience & Customization

### Flow

```
Template detail
  → Select product (Phase 6 intelligence auto-fills text)
  → Customize (headline, CTA, brand kit)
  → Preview configuration (no credits)
  → Generate (existing Creative Engine)
  → Video Studio
```

### API additions (`/api/v1/templates`)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/:id/preview` | Build preview config, no generation |
| POST | `/:id/customize` | Instantiate + apply overrides |
| POST | `/:id/generate-custom` | Full pipeline with customization |

Existing instantiate/generate unchanged.

### Types

`TemplateCustomization`, `TemplatePreviewConfig`, `TemplateTextOverrides`, `TemplateMediaOverrides`

### Frontend

`/templates/view/:id` — preview area, product selector, customizer, config preview, Generate Video

### Credits

No charge for browse / customize / preview.

### Security

Auth, Zod URL limits on media overrides, workspace product ownership via ProductService.
