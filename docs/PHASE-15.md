# Aura Video AI — Phase 15

## AI Gateway routing and model governance

Phase 15 closes the remaining static routing gaps identified during the production-readiness review.

### Implemented

- Explicit `modelId` requests now reach the requested model instead of being silently re-ranked.
- Explicit model requests fail when the model lacks the requested capability.
- Explicit model requests fail when the provider is disabled, missing a key, or otherwise unroutable.
- Provider-scoped routing validates capability support before invoking a workspace provider instance.
- Workspace-scoped provider instances can be ranked without requiring a global registry entry.
- Persisted model allowlists are default-deny after the repository has been consulted.
- Providers without allowlist rows are not implicitly trusted.
- Automatic fallback remains limited to requests without an explicit provider or model.
- Deterministic tests cover explicit models, disabled providers, unsupported capabilities, default deny, and fallback.

### Verification command

```bash
pnpm --filter @aura/api test:ai-gateway
```

Live OpenRouter catalog, provider credentials, database allowlist persistence, and latency/failure behavior
still require runtime verification in a configured environment.
