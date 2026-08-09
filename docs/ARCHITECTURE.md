# Aura Video AI — Architecture (Phase 1)

## Overview

Monorepo SaaS foundation for AI advertising video generation.

## Structure

```
apps/
  api/     — Express + TypeScript backend (Clean Architecture)
  web/     — React user dashboard
  admin/   — React admin panel
packages/
  types/   — Shared TypeScript types
  config/  — Environment & constants (Zod)
  shared/  — Errors, utils, validators
  ui/      — Shared React UI components
  sdk/     — HTTP client for API
docker/    — PostgreSQL + Redis compose
```

## Backend layers

- **Infrastructure**: HTTP, DB (Drizzle), Redis, Storage (R2/Local), Auth (JWT)
- **Domain**: Repositories, Services
- **Application**: Controllers, DI Container

## Auth

- Register / Login (email + password)
- Google Login endpoint (profile exchange)
- JWT access + refresh tokens
- Sessions table with hashed refresh tokens

## Database tables (Phase 1 only)

users, sessions, workspaces, settings, projects, assets, products, templates, subscriptions, credit_wallets

## Storage

Abstract `IStorageProvider` with Local + R2 implementations. Swap via `STORAGE_PROVIDER` env.
