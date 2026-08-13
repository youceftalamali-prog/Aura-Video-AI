import dns from 'node:dns/promises';
import net from 'node:net';
import { AppError } from '@aura/shared';
import { getEnv } from '@aura/config';
import type { TokenCryptoService } from '../../publishing/services/token-crypto.service.js';
import type { IAIProvider } from '../interfaces/ai-provider.interface.js';
import { OpenAIProviderAdapter } from '../gateway/openai-provider.adapter.js';
import { OpenAIProvider } from '../providers/openai.provider.js';
import { OpenRouterProvider } from '../providers/openrouter.provider.js';
import type {
  ProviderConfigPatch,
  ProviderConfigRepository,
  ProviderConfigRow,
} from '../repositories/provider-config.repository.js';

/** Providers this system can configure at runtime. Future: anthropic/google. */
export const CONFIGURABLE_PROVIDERS = ['openrouter', 'openai', 'anthropic', 'google'] as const;
export type ConfigurableProviderId = (typeof CONFIGURABLE_PROVIDERS)[number];

export type ProviderAvailability =
  | 'enabled'
  | 'disabled'
  | 'missing-key'
  | 'invalid'
  | 'not-configured';

/** API-safe view of a provider config: never contains keys. */
export interface SafeProviderConfig {
  id: string;
  workspaceId: string | null;
  providerId: string;
  enabled: boolean;
  baseUrl: string | null;
  defaultModelId: string | null;
  capabilities: string[];
  hasKey: boolean;
  maskedHint: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Effective runtime configuration for a provider (key decrypted for internal use only). */
export interface ProviderResolution {
  providerId: string;
  source: 'workspace' | 'system' | 'env';
  enabled: boolean;
  state: ProviderAvailability;
  baseUrl: string;
  apiKey: string | null;
  defaultModelId: string | null;
  capabilities: string[];
}

export interface ProviderConfigInput {
  /** Validated against CONFIGURABLE_PROVIDERS at runtime. */
  providerId: string;
  workspaceId?: string | null;
  enabled?: boolean;
  baseUrl?: string | null;
  apiKey?: string;
  defaultModelId?: string | null;
  capabilities?: string[];
}

export interface ProviderTestResult {
  success: boolean;
  provider: string;
  latency: number;
  errorCode: string | null;
}

const ALLOWED_CAPABILITIES = new Set(['analyze-text', 'analyze-image', 'analyze-product', 'generate-structured']);

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

/**
 * Runtime configuration of AI providers.
 * - API keys are encrypted at rest with TokenCryptoService (AES-256-GCM); never stored or
 *   returned in plaintext.
 * - Resolution order: workspace config -> system config -> environment fallback.
 * - Base URLs are SSRF-validated (http(s) only, no credentials, no private/reserved hosts).
 */
export class ProviderConfigService {
  constructor(
    private readonly repo: ProviderConfigRepository,
    private readonly crypto: TokenCryptoService,
  ) {}

  async list(workspaceId?: string | null): Promise<SafeProviderConfig[]> {
    const rows = await this.repo.list(workspaceId);
    return rows.map((row) => this.toSafe(row));
  }

  async getById(id: string): Promise<SafeProviderConfig> {
    const row = await this.repo.findById(id);
    if (!row) throw new AppError('AI provider config not found', 404, 'AI_PROVIDER_CONFIG_NOT_FOUND');
    return this.toSafe(row);
  }

  async create(input: ProviderConfigInput): Promise<SafeProviderConfig> {
    const providerId = this.assertProviderId(input.providerId);
    const workspaceId = input.workspaceId ?? null;
    const existing = await this.repo.findByScope(workspaceId, providerId);
    if (existing) {
      throw new AppError(
        `A ${providerId} config already exists for this scope`,
        409,
        'AI_PROVIDER_CONFIG_EXISTS',
      );
    }
    const baseUrl = input.baseUrl ? await this.assertValidBaseUrl(input.baseUrl) : null;
    const encrypted = input.apiKey ? this.crypto.encrypt(input.apiKey) : null;
    const capabilities = this.assertCapabilities(input.capabilities);
    const row = await this.repo.create({
      workspaceId,
      providerId,
      enabled: input.enabled ?? true,
      baseUrl,
      encryptedApiKey: encrypted,
      defaultModelId: input.defaultModelId ?? null,
      capabilities,
    });
    return this.toSafe(row);
  }

  async update(id: string, patch: ProviderConfigPatch & { apiKey?: string }): Promise<SafeProviderConfig> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new AppError('AI provider config not found', 404, 'AI_PROVIDER_CONFIG_NOT_FOUND');

    const dbPatch: ProviderConfigPatch = {};
    if (patch.enabled !== undefined) dbPatch.enabled = patch.enabled;
    if (patch.defaultModelId !== undefined) dbPatch.defaultModelId = patch.defaultModelId;
    if (patch.capabilities !== undefined) dbPatch.capabilities = this.assertCapabilities(patch.capabilities);
    if (patch.baseUrl !== undefined) {
      dbPatch.baseUrl = patch.baseUrl === null ? null : await this.assertValidBaseUrl(patch.baseUrl);
    }
    if (patch.apiKey !== undefined) {
      if (patch.apiKey === '') {
        dbPatch.encryptedApiKey = existing.encryptedApiKey;
      } else {
        dbPatch.encryptedApiKey = this.crypto.encrypt(patch.apiKey);
      }
    }

    const row = await this.repo.update(id, dbPatch);
    if (!row) throw new AppError('AI provider config not found', 404, 'AI_PROVIDER_CONFIG_NOT_FOUND');
    return this.toSafe(row);
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new AppError('AI provider config not found', 404, 'AI_PROVIDER_CONFIG_NOT_FOUND');
  }

  /**
   * Resolves the effective configuration for a provider:
   * workspace config -> system config -> environment fallback.
   * A config row that is disabled stops resolution at that scope (explicit opt-out).
   * An enabled config without a key falls through to the next scope; if nothing
   * below provides a key the resolution is reported with state 'missing-key'.
   */
  async resolveFor(providerId: string, workspaceId?: string | null): Promise<ProviderResolution | null> {
    const workspaceRow = workspaceId ? await this.repo.findByScope(workspaceId, providerId) : null;
    const workspaceMissesKey = workspaceRow !== null && workspaceRow.enabled && workspaceRow.encryptedApiKey === null;
    if (workspaceRow && !workspaceRow.enabled) {
      return this.resolutionFromRow(providerId, workspaceRow, 'workspace', null);
    }
    if (workspaceRow && workspaceRow.encryptedApiKey) {
      return this.resolutionFromRow(providerId, workspaceRow, 'workspace', this.decrypt(workspaceRow));
    }

    const systemRow = await this.repo.findByScope(null, providerId);
    if (systemRow && !systemRow.enabled) {
      return this.resolutionFromRow(providerId, systemRow, 'system', null);
    }
    if (systemRow && systemRow.encryptedApiKey) {
      return this.resolutionFromRow(providerId, systemRow, 'system', this.decrypt(systemRow));
    }

    const envFallback = this.envFallbackFor(providerId);
    if (envFallback) return envFallback;

    if (workspaceMissesKey || (systemRow !== null && systemRow.enabled)) {
      const row = workspaceMissesKey ? workspaceRow! : systemRow!;
      return this.resolutionFromRow(providerId, row, workspaceMissesKey ? 'workspace' : 'system', null);
    }
    return null;
  }

  /** Effective resolution state for a provider at a scope (for admin listing). */
  async availabilityFor(providerId: string, workspaceId?: string | null): Promise<ProviderAvailability> {
    const resolution = await this.resolveFor(providerId, workspaceId);
    return resolution?.state ?? 'not-configured';
  }

  /** Builds a provider instance bound to a resolved config (null for not-yet-supported providers). */
  buildInstance(resolution: ProviderResolution): IAIProvider | null {
    const runtime = {
      baseUrl: resolution.baseUrl,
      apiKey: resolution.apiKey ?? undefined,
      defaultModelId: resolution.defaultModelId ?? undefined,
    };
    switch (resolution.providerId) {
      case 'openrouter':
        return new OpenRouterProvider(runtime);
      case 'openai':
        return new OpenAIProviderAdapter(new OpenAIProvider(runtime));
      default:
        return null;
    }
  }

  /**
   * Cheap non-completion verification: fetches the provider model catalog.
   * Never returns raw secrets; error codes only.
   */
  async test(id: string): Promise<ProviderTestResult> {
    const row = await this.repo.findById(id);
    if (!row) throw new AppError('AI provider config not found', 404, 'AI_PROVIDER_CONFIG_NOT_FOUND');
    if (!row.encryptedApiKey) {
      return { success: false, provider: row.providerId, latency: 0, errorCode: 'AI_PROVIDER_MISSING_KEY' };
    }
    const apiKey = this.decrypt(row);
    const baseUrl = (row.baseUrl ?? this.envBaseUrlFor(row.providerId)).replace(/\/$/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const started = Date.now();
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      const latency = Date.now() - started;
      if (!response.ok) {
        return { success: false, provider: row.providerId, latency, errorCode: 'AI_PROVIDER_AUTH_FAILED' };
      }
      return { success: true, provider: row.providerId, latency, errorCode: null };
    } catch (err) {
      const latency = Date.now() - started;
      if ((err as unknown as Error).name === 'AbortError') {
        return { success: false, provider: row.providerId, latency, errorCode: 'AI_PROVIDER_TIMEOUT' };
      }
      return { success: false, provider: row.providerId, latency, errorCode: 'AI_PROVIDER_UNREACHABLE' };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ===== internals =====

  private toSafe(row: ProviderConfigRow): SafeProviderConfig {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      providerId: row.providerId,
      enabled: row.enabled,
      baseUrl: row.baseUrl,
      defaultModelId: row.defaultModelId,
      capabilities: row.capabilities,
      hasKey: row.encryptedApiKey !== null,
      maskedHint: row.encryptedApiKey ? maskKey(this.decrypt(row)) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private decrypt(row: ProviderConfigRow): string {
    if (!row.encryptedApiKey) throw new AppError('AI provider config has no API key', 500, 'AI_PROVIDER_MISSING_KEY');
    return this.crypto.decrypt(row.encryptedApiKey);
  }

  private resolutionFromRow(
    providerId: string,
    row: ProviderConfigRow,
    source: 'workspace' | 'system',
    apiKey: string | null,
  ): ProviderResolution {
    return {
      providerId,
      source,
      enabled: row.enabled && apiKey !== null,
      state: !row.enabled ? 'disabled' : apiKey === null ? 'missing-key' : 'enabled',
      baseUrl: row.baseUrl ?? this.envBaseUrlFor(providerId),
      apiKey,
      defaultModelId: row.defaultModelId ?? this.envDefaultModelFor(providerId),
      capabilities: row.capabilities,
    };
  }

  private envFallbackFor(providerId: string): ProviderResolution | null {
    const env = getEnv();
    const apiKey =
      providerId === 'openrouter' ? env.OPENROUTER_API_KEY : providerId === 'openai' ? env.AI_API_KEY : '';
    if (!apiKey) return null;
    return {
      providerId,
      source: 'env',
      enabled: true,
      state: 'enabled',
      baseUrl: this.envBaseUrlFor(providerId),
      apiKey,
      defaultModelId: this.envDefaultModelFor(providerId),
      capabilities: [],
    };
  }

  private envBaseUrlFor(providerId: string): string {
    const env = getEnv();
    return providerId === 'openrouter' ? env.OPENROUTER_BASE_URL : env.AI_BASE_URL;
  }

  private envDefaultModelFor(providerId: string): string | null {
    const env = getEnv();
    if (providerId === 'openrouter') return env.OPENROUTER_DEFAULT_MODEL || null;
    if (providerId === 'openai') return env.AI_MODEL;
    return null;
  }

  private assertProviderId(providerId: string): ConfigurableProviderId {
    if (!CONFIGURABLE_PROVIDERS.includes(providerId as ConfigurableProviderId)) {
      throw new AppError(
        `Unsupported AI provider "${providerId}"`,
        400,
        'AI_PROVIDER_INVALID',
        { allowed: CONFIGURABLE_PROVIDERS },
      );
    }
    return providerId as ConfigurableProviderId;
  }

  private assertCapabilities(capabilities?: string[]): string[] {
    const list = (capabilities ?? []).filter((c) => typeof c === 'string');
    for (const capability of list) {
      if (!ALLOWED_CAPABILITIES.has(capability)) {
        throw new AppError(`Unsupported AI capability "${capability}"`, 400, 'AI_PROVIDER_INVALID');
      }
    }
    return list;
  }

  /** SSRF-safe validation: https(s) only, no credentials, no private/reserved hosts. */
  private async assertValidBaseUrl(raw: string): Promise<string> {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new AppError('baseUrl must be a valid URL', 400, 'AI_PROVIDER_INVALID');
    }
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && getEnv().NODE_ENV === 'development')) {
      throw new AppError('baseUrl must use https', 400, 'AI_PROVIDER_INVALID');
    }
    if (url.username || url.password) {
      throw new AppError('baseUrl must not contain credentials', 400, 'AI_PROVIDER_INVALID');
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.localhost')) {
      throw new AppError('baseUrl host must be reachable publicly', 400, 'AI_PROVIDER_INVALID');
    }
    if (net.isIP(hostname)) {
      if (isReservedAddress(hostname)) {
        throw new AppError('baseUrl must not point to a private or reserved address', 400, 'AI_PROVIDER_INVALID');
      }
      return raw;
    }
    try {
      const addresses = await Promise.race([
        dns.lookup(hostname, { all: true }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('dns timeout')), 5000)),
      ]);
      if (addresses.length === 0 || addresses.some((a) => isReservedAddress(a.address))) {
        throw new AppError('baseUrl host must resolve to a public address', 400, 'AI_PROVIDER_INVALID');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('baseUrl host could not be verified', 400, 'AI_PROVIDER_INVALID');
    }
    return raw;
  }
}

function isReservedAddress(address: string): boolean {
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1' || normalized.startsWith('::ffff:')) {
      const mappedV4 = normalized.startsWith('::ffff:') ? normalized.slice(7) : '';
      return mappedV4 ? isReservedAddress(mappedV4) : true;
    }
    if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('ff00:')) return true;
    return false;
  }
  const parts = address.split('.').map(Number);
  if (parts.length !== 4) return true;
  const [a, b] = parts as [number, number, number, number];
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0 || a === 255) return true;
  if (a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}
