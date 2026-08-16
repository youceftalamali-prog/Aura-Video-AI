/**
 * Deterministic Phase E test suite for Customer Settings + Developer Settings
 * (no paid AI calls, no network except a real listen(0) HTTP socket).
 *
 * Run with: pnpm --filter @aura/api exec tsx scripts/settings-deterministic-test.ts
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/aura_test_dummy';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'settings-test-secret-0123456789abcdef0123456789';
process.env.TOKEN_ENCRYPTION_KEY = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
process.env.OPENROUTER_DEFAULT_MODEL = 'env-fallback-model';
process.env.AI_MODEL = 'gpt-4o-mini';

import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { InMemoryProviderConfigRepository } from '../src/modules/ai/repositories/provider-config.repository.js';
import { ProviderConfigService } from '../src/modules/ai/services/provider-config.service.js';
import { TokenCryptoService } from '../src/modules/publishing/services/token-crypto.service.js';
import { AdminController } from '../src/infrastructure/http/controllers/admin.controller.js';
import { createAdminRoutes } from '../src/infrastructure/http/routes/admin.routes.js';
import { SettingsController } from '../src/modules/settings/controllers/settings.controller.js';
import { createSettingsRoutes } from '../src/modules/settings/routes/settings.routes.js';
import { SettingsResolver } from '../src/modules/settings/services/settings-resolver.service.js';
import {
  InMemoryUserPreferencesRepository,
} from '../src/modules/settings/repositories/user-preferences.repository.js';
import {
  InMemoryWorkspaceSettingsRepository,
} from '../src/modules/settings/repositories/workspace-settings.repository.js';
import { errorHandler } from '../src/infrastructure/http/middleware/error.middleware.js';
import type { SettingsRepository } from '../src/domain/repositories/settings.repository.js';
import type { UserRepository } from '../src/domain/repositories/user.repository.js';
import type { WorkspaceRepository } from '../src/domain/repositories/workspace.repository.js';
import type { AIGateway } from '../src/modules/ai/gateway/ai-gateway.js';
import type { PublicUser, User } from '@aura/types';

const USER_ID = randomUUID();
const OTHER_USER_ID = randomUUID();
const ADMIN_ID = randomUUID();
const WS_ID = randomUUID();
const OTHER_WS_ID = randomUUID();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

class InMemorySettingsRepository {
  private store = new Map<string, { value: unknown; description: string | null }>();

  async get(key: string): Promise<unknown | null> {
    const row = this.store.get(key);
    return row ? row.value : null;
  }

  async set(key: string, value: unknown, description?: string): Promise<void> {
    this.store.set(key, { value, description: description ?? null });
  }

  async list(): Promise<{ key: string; value: unknown; description: string | null }[]> {
    return [...this.store.entries()].map(([key, row]) => ({ key, value: row.value, description: row.description }));
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function makeUsersStore(): Map<string, Partial<User> & { id: string; email: string; fullName: string }> {
  const store = new Map<string, Partial<User> & { id: string; email: string; fullName: string }>();
  store.set(USER_ID, {
    id: USER_ID,
    email: 'customer@aura.test',
    fullName: 'Customer One',
    preferredLanguage: 'fr',
    role: 'user',
    status: 'active',
    avatarUrl: null,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  store.set(OTHER_USER_ID, {
    id: OTHER_USER_ID,
    email: 'other@aura.test',
    fullName: 'Other User',
    preferredLanguage: 'en',
    role: 'user',
    status: 'active',
    avatarUrl: null,
    emailVerifiedAt: null,
    createdAt: new Date().toISOString(),
  });
  store.set(ADMIN_ID, {
    id: ADMIN_ID,
    email: 'admin@aura.test',
    fullName: 'Platform Admin',
    preferredLanguage: 'en',
    role: 'admin',
    status: 'active',
    avatarUrl: null,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  });
  return store;
}

function makeWorkspaceStore() {
  return new Map<string, { id: string; name: string; slug: string; ownerId: string }>([
    { id: WS_ID, name: 'Personal', slug: 'personal', ownerId: USER_ID },
    { id: OTHER_WS_ID, name: 'Other Workspace', slug: 'other-workspace', ownerId: OTHER_USER_ID },
  ].map((w) => [w.id, w]));
}

function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, email: 'x@aura.test', role, type: 'access' }, process.env.JWT_SECRET!, {
    expiresIn: '15m',
  });
}

interface Harness {
  server: { close(): Promise<void> };
  rawGet(path: string, token: string): Promise<{ status: number; body: string }>;
  rawSend(method: string, path: string, token: string, body?: unknown): Promise<{ status: number; body: string }>;
}

async function startServer(): Promise<Harness> {
  const usersStore = makeUsersStore();
  const workspaceStore = makeWorkspaceStore();
  const kv = new InMemorySettingsRepository();
  const userPreferences = new InMemoryUserPreferencesRepository();
  const workspaceSettings = new InMemoryWorkspaceSettingsRepository();

  const users = {
    findById: async (id: string) => usersStore.get(id) ?? null,
    toPublic: (user: Partial<User> & { id: string; email: string; fullName: string }): PublicUser => ({
      id: user.id!,
      email: user.email!,
      fullName: user.fullName!,
      preferredLanguage: (user as { preferredLanguage?: string }).preferredLanguage || 'en',
      avatarUrl: user.avatarUrl ?? null,
      role: (user.role ?? 'user') as PublicUser['role'],
      status: (user.status ?? 'active') as PublicUser['status'],
      emailVerifiedAt: user.emailVerifiedAt ?? null,
      createdAt: user.createdAt ?? new Date().toISOString(),
    }),
    updatePreferredLanguage: async (userId: string, language: string) => {
      const user = usersStore.get(userId);
      if (user) user.preferredLanguage = language;
      return user ? users.toPublic(user) : null;
    },
  } as unknown as UserRepository;

  const workspaces = {
    findById: async (id: string) => workspaceStore.get(id) ?? null,
    findPersonalByOwnerId: async (ownerId: string) =>
      [...workspaceStore.values()].find((w) => w.ownerId === ownerId) ?? null,
    findByOwnerId: async () => [],
    create: async () => ({ id: randomUUID(), name: '', slug: '', ownerId: USER_ID, isPersonal: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
  } as unknown as WorkspaceRepository;

  const resolver = new SettingsResolver(
    userPreferences,
    workspaceSettings,
    kv as unknown as SettingsRepository,
    { envDefaultModel: process.env.OPENROUTER_DEFAULT_MODEL || null },
  );

  const settingsController = new SettingsController(
    users,
    workspaces,
    resolver,
    userPreferences,
    workspaceSettings,
  );

  const providerConfigs = new ProviderConfigService(
    new InMemoryProviderConfigRepository(),
    new TokenCryptoService(),
  );

  const fakeGateway = {
    listModels: async () => [
      {
        id: 'fake-model-a',
        displayName: 'Fake Model A',
        provider: 'openai',
        capabilities: ['analyze-text', 'generate-structured'],
        contextWindow: 4096,
        promptPrice: 0.5,
        completionPrice: 1.5,
        source: 'env',
        isDefault: true,
      },
      {
        id: 'openrouter/fake-b',
        displayName: 'Fake Model B',
        provider: 'openrouter',
        capabilities: ['analyze-text'],
        contextWindow: 8192,
        promptPrice: 0.25,
        completionPrice: 0.75,
        supportsVision: true,
        source: 'catalog',
        isDefault: false,
      },
    ],
    refreshModelsCatalog: async () => [
      { id: 'fake-model-a', displayName: 'Fake Model A', provider: 'openai', capabilities: [], contextWindow: 4096, promptPrice: 0.5, completionPrice: 1.5, source: 'env', isDefault: true },
      { id: 'openrouter/fake-b', displayName: 'Fake Model B', provider: 'openrouter', capabilities: [], contextWindow: 8192, promptPrice: 0.25, completionPrice: 0.75, supportsVision: true, source: 'catalog', isDefault: false },
    ],
    getRegistryStatus: async () => ({
      providers: { openai: 'enabled', openrouter: 'not-configured' },
      models: {
        staticCount: 2,
        catalogCount: 1,
        loaded: true,
        fresh: true,
        refreshedAt: Date.now(),
        ttlMs: 3600000,
        lastError: null,
      },
    }),
    syncConfiguredProviders: async () => undefined,
  } as unknown as AIGateway;

  const adminController = new AdminController(
    users,
    kv as unknown as SettingsRepository,
    providerConfigs,
    fakeGateway,
  );

  const app = express();
  app.use(express.json());
  app.use('/api/v1/settings', createSettingsRoutes(settingsController));
  app.use('/api/v1/admin', createAdminRoutes(adminController));
  app.use(errorHandler);

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address() as import('node:net').AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;

  async function rawGet(path: string, token: string) {
    const res = await fetch(`${base}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, body: await res.text() };
  }

  async function rawSend(method: string, path: string, token: string, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.text() };
  }

  return {
    server: { close: () => new Promise<void>((resolve) => server.close(() => resolve())) },
    rawGet,
    rawSend,
    store: { users: usersStore, kv },
  };
}

async function main() {
  const h = await startServer();
  const customer = signToken(USER_ID, 'user');
  const admin = signToken(ADMIN_ID, 'admin');
  const other = signToken(OTHER_USER_ID, 'user');

  try {
    console.log('Scenario 1: customer reads own settings');
    {
      const res = await h.rawGet('/api/v1/settings/user', customer);
      const data = JSON.parse(res.body).data;
      check('200', res.status === 200, res.body);
      check('profile present', data?.profile?.email === 'customer@aura.test');
      check('preferences present', Boolean(data?.preferences));
      check('language seeded from users.preferredLanguage', data?.preferences?.language === 'fr', JSON.stringify(data?.preferences));
      check('resolved language fr', data?.resolved?.language === 'fr');
      check('unset strategy is null, resolved balanced', data?.preferences?.aiStrategy === null && data?.resolved?.ai?.strategy === 'balanced', JSON.stringify(data?.resolved));
      check('workspace attached', data?.workspace?.id === WS_ID);
      check('no secrets in payload', !res.body.includes('apiKey') && !res.body.includes('encrypted'), res.body);
    }

    console.log('Scenario 2: customer updates own preferences');
    {
      const res = await h.rawSend('PATCH', '/api/v1/settings/user', customer, {
        language: 'ar',
        aiStrategy: 'fast',
        notifications: { billing: false },
      });
      const data = JSON.parse(res.body).data;
      check('200', res.status === 200, res.body);
      check('strategy persisted', data?.preferences?.aiStrategy === 'fast');
      check('language persisted', data?.preferences?.language === 'ar');
      check('billing notification off', data?.preferences?.notifications?.billing === false);
      check('other notifications preserved (emailAlerts)', data?.preferences?.notifications?.emailAlerts === true, JSON.stringify(data?.preferences?.notifications));
      check('users.preferredLanguage synced', h.store.users.get(USER_ID)?.preferredLanguage === 'ar');

      const read = await h.rawGet('/api/v1/settings/user', customer);
      const readData = JSON.parse(read.body).data;
      check('re-read strategy persisted', readData?.preferences?.aiStrategy === 'fast');
      check('resolved strategy fast', readData?.resolved?.ai?.strategy === 'fast');
      check('re-read language persisted', readData?.preferences?.language === 'ar');
    }

    console.log('Scenario 3: cannot manage another workspace');
    {
      const res = await h.rawSend('PATCH', '/api/v1/settings/workspace', customer, {
        workspaceId: OTHER_WS_ID,
        aiStrategy: 'smart',
      });
      const body = JSON.parse(res.body);
      check('403', res.status === 403, res.body);
      check('error code AUTHORIZATION_ERROR', body?.error?.code === 'AUTHORIZATION_ERROR', res.body);
      const otherOwner = await h.rawGet(`/api/v1/settings/workspace?workspaceId=${OTHER_WS_ID}`, other);
      check('owner of other workspace can read it', otherOwner.status === 200, otherOwner.body);
    }

    console.log('Scenario 4: admin reads developer settings');
    {
      const settings = await h.rawGet('/api/v1/admin/settings', admin);
      check('GET /admin/settings 200', settings.status === 200);
      const providers = await h.rawGet('/api/v1/admin/ai-providers', admin);
      check('GET /admin/ai-providers 200', providers.status === 200, providers.body);
      const parsed = JSON.parse(providers.body).data;
      check('providers array present', Array.isArray(parsed?.providers) && parsed.providers.length >= 2);
      check('registry status present', Boolean(parsed?.registry?.models));
      const health = await h.rawGet('/api/v1/admin/system/health', admin);
      check('GET /admin/system/health 200', health.status === 200, health.body);
      const flags = await h.rawGet('/api/v1/admin/feature-flags', admin);
      check('GET /admin/feature-flags 200', flags.status === 200);
      const models = await h.rawGet('/api/v1/admin/ai/models', admin);
      check('GET /admin/ai/models 200', models.status === 200, models.body);
    }

    console.log('Scenario 5: normal user is blocked from developer settings');
    {
      for (const path of ['/api/v1/admin/ai-providers', '/api/v1/admin/system/health', '/api/v1/admin/feature-flags', '/api/v1/admin/settings']) {
        const res = await h.rawGet(path, customer);
        check(`403 on ${path}`, res.status === 403, res.body);
      }
    }

    console.log('Scenario 6: API key is never returned by any endpoint');
    {
      const create = await h.rawSend('POST', '/api/v1/admin/ai-providers', admin, {
        providerId: 'openai',
        apiKey: 'sk-TOP-SECRET-999',
        enabled: true,
      });
      check('create 201', create.status === 201, create.body);
      check('create response has no key', !create.body.includes('sk-TOP-SECRET'), create.body);
      check('create response has no apiKey field', !create.body.includes('apiKey'), create.body);

      const list = await h.rawGet('/api/v1/admin/ai-providers', admin);
      check('list response has no key', !list.body.includes('sk-TOP-SECRET'), list.body);

      const update = await h.rawSend('PATCH', `/api/v1/admin/ai-providers/${JSON.parse(create.body).data.id}`, admin, {
        enabled: false,
      });
      check('update 200', update.status === 200, update.body);
      check('update response has no key', !update.body.includes('sk-TOP-SECRET'), update.body);
      check('update response has no apiKey field', !update.body.includes('apiKey'), update.body);

      const allSettings = await h.rawGet('/api/v1/admin/settings', admin);
      check('settings store listing has no key material', !allSettings.body.includes('sk-TOP-SECRET'), allSettings.body);
    }

    console.log('Scenario 7: maskedHint is correct, hasKey true');
    {
      const config = JSON.parse((await h.rawSend('POST', '/api/v1/admin/ai-providers', admin, {
        providerId: 'openrouter',
        apiKey: 'sk-or-v1-SECRETVALUE',
      })).body).data;
      check('hasKey true', config?.hasKey === true);
      check('maskedHint format first4****last4', config?.maskedHint === 'sk-o****ALUE', JSON.stringify(config?.maskedHint));
      check('no plaintext anywhere in config', !JSON.stringify(config).includes('SECRETVALUE'));
    }

    console.log('Scenario 8: model catalog is visible to admin');
    {
      const res = await h.rawGet('/api/v1/admin/ai/models', admin);
      const models = JSON.parse(res.body).data;
      check('200 with 2 models', res.status === 200 && Array.isArray(models) && models.length === 2, res.body);
      check('model ids correct', models?.some((m: { id: string }) => m.id === 'fake-model-a') && models?.some((m: { id: string }) => m.id === 'openrouter/fake-b'));
      check('pricing included', models?.[0]?.pricing?.prompt === 0.5, res.body);
      check('vision flag included', models?.some((m: { supportsVision: boolean }) => m.supportsVision === true));
      const refresh = await h.rawSend('POST', '/api/v1/admin/ai/models/refresh', admin);
      const refreshData = JSON.parse(refresh.body).data;
      check('refresh 200 with count', refresh.status === 200 && refreshData?.count === 2, refresh.body);
      check('catalog endpoint never leaks keys', !refresh.body.includes('sk-'), refresh.body);
    }

    console.log('Scenario 9: fast/balanced/smart persist end to end');
    {
      await h.rawSend('PATCH', '/api/v1/settings/user', customer, { aiStrategy: 'fast' });
      let read = JSON.parse((await h.rawGet('/api/v1/settings/user', customer)).body).data;
      check('fast persisted + resolved', read?.preferences?.aiStrategy === 'fast' && read?.resolved?.ai?.strategy === 'fast');

      await h.rawSend('PATCH', '/api/v1/settings/user', customer, { aiStrategy: 'smart' });
      read = JSON.parse((await h.rawGet('/api/v1/settings/user', customer)).body).data;
      check('smart persisted + resolved', read?.preferences?.aiStrategy === 'smart' && read?.resolved?.ai?.strategy === 'smart');

      const ws = await h.rawSend('PATCH', '/api/v1/settings/workspace', customer, { aiStrategy: 'balanced' });
      check('workspace patch 200', ws.status === 200, ws.body);
      const wsRead = JSON.parse((await h.rawGet('/api/v1/settings/workspace', customer)).body).data;
      check('workspace strategy balanced', wsRead?.settings?.aiStrategy === 'balanced', wsRead?.settings?.aiStrategy);
      check('workspace resolved strategy balanced (user pref wins above ws)', wsRead?.resolved?.ai?.strategy === 'smart', JSON.stringify(wsRead?.resolved));

      await h.rawSend('PUT', '/api/v1/admin/settings/ai.strategy', admin, { value: 'fast' });
      const user2 = JSON.parse((await h.rawGet('/api/v1/settings/user', other)).body).data;
      check('system default strategy flows to customer', user2?.resolved?.ai?.strategy === 'fast', JSON.stringify(user2?.resolved));
      await h.rawSend('PUT', '/api/v1/admin/settings/ai.strategy', admin, { value: 'balanced' });
    }

    console.log('Scenario 10: precedence override > user > workspace > system > env (unit)');
    {
      const kv = h.store.kv;
      const userPrefs = new InMemoryUserPreferencesRepository();
      const wsPrefs = new InMemoryWorkspaceSettingsRepository();
      const r2 = new SettingsResolver(userPrefs, wsPrefs, kv as unknown as SettingsRepository, {
        envDefaultModel: 'env-fallback-model',
      });

      const u = randomUUID();
      const w = randomUUID();

      const envOnly = await r2.resolveAi({ userId: u, workspaceId: null }, {});
      check('env fallback model when nothing set', envOnly.model === 'env-fallback-model', String(envOnly.model));
      check('default strategy when nothing set', envOnly.strategy === 'balanced');

      await kv.set('ai.default_model', 'sys-model');
      await kv.set('ai.strategy', 'fast');
      await kv.set('app.default_language', 'de');

      const sysWins = await r2.resolveAi({ userId: u, workspaceId: null }, {});
      check('system model beats env', sysWins.model === 'sys-model', String(sysWins.model));
      check('system strategy beats default', sysWins.strategy === 'fast');

      await wsPrefs.create(w, { defaultAiModel: 'ws-model' });
      const wsWins = await r2.resolveAi({ userId: u, workspaceId: w }, {});
      check('workspace model beats system', wsWins.model === 'ws-model', String(wsWins.model));

      await userPrefs.create(u, { defaultAiModel: 'user-model', aiStrategy: 'smart' });
      const userWins = await r2.resolveAi({ userId: u, workspaceId: w }, {});
      check('user model beats workspace', userWins.model === 'user-model');
      check('user strategy beats system', userWins.strategy === 'smart');

      const override = await r2.resolveAi({ userId: u, workspaceId: w }, { model: 'ovr-model', strategy: 'balanced' });
      check('request override beats user', override.model === 'ovr-model' && override.strategy === 'balanced');

      const sysLang = await r2.resolveAll({ userId: randomUUID(), workspaceId: null });
      check('system default language for fresh user', sysLang.language === 'de', sysLang.language);

      await userPrefs.upsert(u, { language: 'en' });
      const userLang = await r2.resolveLanguage(u);
      check('user language beats system', userLang === 'en', userLang);

      const video = await r2.resolveVideoDefaults({ userId: u });
      check('video defaults computed', video.defaultDuration === 30 && video.defaultAspectRatio === '9:16' && video.defaultResolution === '1080p', JSON.stringify(video));

      await kv.set('app.default_video_duration', 45);
      const withSystemVideo = await r2.resolveVideoDefaults({ userId: u });
      check('system video duration applies when user has none', withSystemVideo.defaultDuration === 45);
    }

    console.log('Scenario 10b: feature flags CRUD via admin');
    {
      const put = await h.rawSend('PUT', '/api/v1/admin/feature-flags/flags.test_feature', admin, { enabled: true, description: 'Test flag' });
      check('create flag 200', put.status === 200, put.body);
      const list = JSON.parse((await h.rawGet('/api/v1/admin/feature-flags', admin)).body).data;
      check('flag listed enabled', list?.some((f: { key: string; enabled: boolean }) => f.key === 'flags.test_feature' && f.enabled === true), JSON.stringify(list));
      const bad = await h.rawSend('PUT', '/api/v1/admin/feature-flags/not_a_flag', admin, { enabled: true });
      check('non-flags key rejected', bad.status === 400, bad.body);
      const del = await h.rawSend('DELETE', '/api/v1/admin/feature-flags/flags.test_feature', admin);
      check('delete flag 200', del.status === 200);
      const after = JSON.parse((await h.rawGet('/api/v1/admin/feature-flags', admin)).body).data;
      check('flag removed', !after?.some((f: { key: string }) => f.key === 'flags.test_feature'));
    }

    console.log('Scenario 10c: invalid payloads fail cleanly');
    {
      const bad = await h.rawSend('PATCH', '/api/v1/settings/user', customer, { aiStrategy: 'turbo' });
      check('invalid strategy rejected', bad.status >= 400 && JSON.parse(bad.body).success === false, bad.body);
      const badWs = await h.rawSend('PATCH', '/api/v1/settings/workspace', customer, { workspaceId: 'not-a-uuid' });
      check('invalid workspaceId rejected', badWs.status >= 400 && JSON.parse(badWs.body).success === false, badWs.body);
    }
  } finally {
    await h.server.close();
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('Failures:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
