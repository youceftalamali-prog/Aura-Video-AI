# Aura Video AI — Phase 18

## Project and video asset integrity

Phase 18 makes the generated video asset the canonical project output and removes reliance on persisted signed URLs.

### Implemented

- Added `projects.video_asset_id` with a foreign key to `assets.id`.
- Added an index for project video-asset lookups.
- Added a migration backfill that links each project to its latest completed video job asset when available.
- Cleared previously persisted project video URLs so expired URLs are not reused.
- Updated the video pipeline to link the created asset to the project only after storage persistence succeeds.
- Marked the project completed at the same output boundary and stored duration/aspect metadata.
- Updated project reads to resolve a fresh signed URL from the canonical asset only when the asset is ready, belongs to the same workspace, and exists in storage.
- Removed the unused internal path that could write a project video URL directly.
- Added deterministic API-boundary checks preventing clients from setting `videoUrl`, `videoAssetId`, completed status, or arbitrary server-owned fields.
- Extended the runtime gate to verify `projects.video_asset_id`.

### Checks

```bash
pnpm --filter @aura/api test:video-asset
pnpm --filter @aura/api test:runtime
pnpm typecheck
pnpm build
```

The deterministic suite proves request-boundary behavior. The runtime suite proves the migration and column only when it is run against a real PostgreSQL instance.
