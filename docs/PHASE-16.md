# Aura Video AI — Phase 16

## Product Intelligence persistence and SDK contract

Phase 16 makes Product Intelligence safe to consume from the SDK and prevents a failed refresh from silently serving stale intelligence.

### Implemented

- Added `strategy?: fast | balanced | smart` to SDK product URL import.
- Added SDK `refreshProductIntelligence(id, strategy?)`.
- Added SDK `generateProductHooks(id, strategy?)`.
- Persisted intelligence versions continue to increment for ready and failed transitions.
- A failed persisted intelligence record now fails closed instead of falling back to older metadata.
- Added deterministic coverage for ready version 1, ready version 2, failed version 3, readback, error-code persistence, and stale-data rejection.

### Verification commands

```bash
pnpm --filter @aura/api test:product-intelligence
pnpm --filter @aura/sdk typecheck
```

The persistence harness is deterministic and does not require PostgreSQL. A real migration/database run is still required for runtime verification.
