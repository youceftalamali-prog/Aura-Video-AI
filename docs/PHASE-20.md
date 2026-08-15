# Aura Video AI — Phase 20

## Storage and FFmpeg runtime readiness

Phase 20 closes the local delivery verification gap between video composition, storage persistence, signed URLs, and export readiness.

### Implemented

- Added a runtime local-storage probe that uploads, checks existence, signs, verifies, rotates expiry, and deletes a real object.
- Verifies that a signed token is bound to its original storage key.
- Verifies that storage path traversal is rejected.
- Added an FFmpeg smoke composition using a one-second vertical `9:16` scene.
- Verifies that FFmpeg produces a non-empty `video/mp4` output.
- Cleans all runtime probe objects and temporary composed files.
- Added deterministic signing checks for valid, expired, tampered, and wrong-key tokens.
- Added a signed-URL lifetime cap check.

### Checks

Offline/local storage policy check:

```bash
pnpm --filter @aura/api test:storage
```

Full runtime gate:

```bash
pnpm --filter @aura/api test:runtime
```

The full runtime gate requires PostgreSQL, Redis, local storage access, and an installed `ffmpeg` executable. It does not call OpenRouter, PayPal, R2, or an external media provider.

The runtime result is not considered passed until executed in an environment containing the repository dependencies and services.
