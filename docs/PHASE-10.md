# Aura Video AI — Phase 10

## Projects & Assets Library

### Objective

Close the SaaS loop after template/video generation: manage **projects** and **assets**, and **export** completed videos — using existing tables only.

### Features

- Project CRUD (list, create, get, update, delete)
- Asset list/get by ownership
- Export metadata + download URL for ready assets
- Library UI at `/library`

### API (`/api/v1/library`)

| Method | Path |
|--------|------|
| GET/POST | `/projects` |
| GET/PATCH/DELETE | `/projects/:id` |
| GET | `/assets` |
| GET | `/assets/:id` |
| GET | `/assets/:id/export` |

### Database

None — uses existing `projects` and `assets`.

### Security

Auth, user ownership on all operations, Zod validation, rate limiting.
Export never invents URLs; requires `status=ready` and existing storage URL.

### Credits

No new charges.
