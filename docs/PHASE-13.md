# Aura Video AI — Phase 13

## Final video delivery, preview & download

### Flow
```
Video job completed → asset stored → preview → DOWNLOAD VIDEO → Library
```

### Rules
- **0 credits** for preview/download
- **No** automatic social publishing (Phase 7 left intact, unused here)
- Real storage URLs only (no mocks)

### Reused
- `GET /api/v1/library/assets/:id/export` (ownership + ready check)
- `CreditLedgerService` unchanged
- Video Studio `/video`, Library `/library`
- Storage abstraction (local / R2)

### Export response
```json
{ "assetId", "url", "mimeType", "name", "filename", "sizeBytes" }
```
`filename` is sanitized: `aura-video-{name}.mp4`

### Frontend
- `VideoResultCard` — ready state, native `<video controls>`, download states
- `lib/download.ts` — blob download via export API

### Security
Auth + asset ownership via LibraryService.getAsset / exportAsset.
No client-supplied storage keys.
