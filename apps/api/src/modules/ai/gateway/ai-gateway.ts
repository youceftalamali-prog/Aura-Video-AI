import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import type { AICapability, ModelDescriptor, ProductAnalysis, RoutingStrategy } from '@aura/types';
import type {
  AnalyzeImageParams,
  AnalyzeProductParams,
  AnalyzeTextParams,
  GenerateStructuredParams,
  IAIProvider,
} from '../interfaces/ai-provider.interface.js';
import type { ProviderConfigService, ProviderResolution } from '../services/provider-config.service.js';
import { fetchOpenRouterCatalog, toModelDescriptor } from './openrouter-catalog.js';
import type { ResolvedCandidate } from './routing-resolver.js';
import type { ModelRegistry } from './model-registry.js';
import type { ProviderAvailability, ProviderRegistry } from './provider-registry.js';
import type { RoutingResolver } from './routing-resolver.js';

/** Per-request execution options for gateway calls. */
export interface ExecuteOptions {
  /** Restrict routing to a specific provider (e.g. 'openai' | 'openrouter'). */
  providerId?: string;
  /** Override the gateway strategy for this call only. */
  strategy?: RoutingStrategy;
  /** Resolve workspace-specific provider configuration (when configured). */
  workspaceId?: string;
}

/**
 * Central AI gateway. Implements IAIProvider so existing services can keep
 * their current call sites while routing through the gateway.
 *
 * Phase B: per-request `modelId` (via params), `providerId`/`strategy`
 * (via options), and a single retry with the next-ranked candidate — only for
 * automatic routing (no explicit modelId/providerId). An explicit modelId is
 * never silently substituted; unknown models raise AI_MODEL_UNAVAILABLE.
 *
 * Phase C: runtime provider configuration. DB system-scope configs are synced
 * into the registry on first use; workspace-scoped configs are resolved per
 * call (provider + workspaceId -> effective configuration).
 */
export class AIGateway implements IAIProvider {
  readonly name = 'gateway';

  strategy: RoutingStrategy = 'balanced';

  private syncPromise: Promise<void> | null = null;

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly resolver: RoutingResolver,
    private readonly models: ModelRegistry,
    private readonly configService: ProviderConfigService | null = null,
  ) {}

  execute(capability: AICapability, strategy: RoutingStrategy = this.strategy, options: ExecuteOptions = {}): IAIProvider {
    return this.resolver.rank(strategy, capability, options)[0]!.provider;
  }

  getProvider(name: string): IAIProvider {
    return this.providers.get(name);
  }

  getModel(modelOrAlias: string) {
    return this.models.resolve(modelOrAlias);
  }

  analyzeText(params: AnalyzeTextParams, options: ExecuteOptions = {}): Promise<string> {
    return this.withFallback('analyze-text', params, options, (candidate) =>
      candidate.provider.analyzeText(this.withModel(params, candidate)),
    );
  }

  analyzeProduct(params: AnalyzeProductParams, options: ExecuteOptions = {}): Promise<ProductAnalysis> {
    return this.withFallback('analyze-product', params, options, (candidate) =>
      candidate.provider.analyzeProduct(this.withModel(params, candidate)),
    );
  }

  generateStructuredOutput<T>(params: GenerateStructuredParams<T>, options: ExecuteOptions = {}): Promise<T> {
    return this.withFallback('generate-structured', params, options, (candidate) =>
      candidate.provider.generateStructuredOutput(this.withModel(params, candidate)),
    );
  }

  analyzeImage(params: AnalyzeImageParams, options: ExecuteOptions = {}): Promise<string> {
    return this.withFallback('analyze-image', params, options, (candidate) =>
      candidate.provider.analyzeImage!(this.withModel(params, candidate)),
    );
  }

  // ===== Phase C: runtime provider configuration =====

  /** Effective configuration for a provider at an optional workspace scope. */
  async getProviderConfig(providerId: string, workspaceId?: string | null): Promise<ProviderResolution | null> {
    await this.syncConfiguredProviders();
    if (!this.configService) return null;
    return this.configService.resolveFor(providerId, workspaceId ?? null);
  }

  /** Provider instance bound to the effective configuration (null when unavailable). */
  async getProviderInstance(providerId: string, workspaceId?: string | null): Promise<IAIProvider | null> {
    const resolution = await this.getProviderConfig(providerId, workspaceId);
    if (!resolution || resolution.state !== 'enabled' || !resolution.apiKey) return null;
    if (resolution.source === 'workspace' || !this.providers.has(providerId)) {
      return this.configService!.buildInstance(resolution);
    }
    return this.providers.get(providerId);
  }

  /** Safe model list for the public endpoint (no secrets). */
  async listModels(): Promise<ModelDescriptor[]> {
    await this.syncConfiguredProviders();
    await this.models.refreshIfStale();
    return this.models.list();
  }

  /** Forces a catalog refresh and returns the fresh model list (admin action). */
  async refreshModelsCatalog(): Promise<ModelDescriptor[]> {
    await this.syncConfiguredProviders();
    await this.models.refresh();
    return this.models.list();
  }

  /** Registry availability + model cache status (admin listing). */
  async getRegistryStatus(): Promise<{
    providers: Record<string, ProviderAvailability>;
    models: ReturnType<ModelRegistry['status']>;
  }> {
    await this.syncConfiguredProviders();
    const providers: Record<string, ProviderAvailability> = {};
    for (const provider of this.providers.all()) {
      providers[provider.name] = this.providers.availabilityOf(provider.name);
    }
    return { providers, models: this.models.status() };
  }

  /** Loads system-scope DB provider configs into the runtime registry (coalesced). */
  async syncConfiguredProviders(): Promise<void> {
    if (!this.configService) return;
    if (!this.syncPromise) {
      this.syncPromise = this.doSync().finally(() => {
        this.syncPromise = null;
      });
    }
    return this.syncPromise;
  }

  // ===== internals =====

  private async doSync(): Promise<void> {
    const configs = await this.configService!.list(null);
    for (const config of configs) {
      const resolution = await this.configService!.resolveFor(config.providerId, null);
      if (!resolution) continue;
      if (resolution.state === 'disabled') {
        this.providers.setAvailability(config.providerId, 'disabled');
        continue;
      }
      if (resolution.state === 'missing-key') {
        this.providers.setAvailability(config.providerId, 'missing-key');
        continue;
      }
      const instance = this.configService!.buildInstance(resolution);
      if (instance) {
        this.providers.register(instance, false, 'enabled');
      }
      if (config.providerId === 'openrouter') {
        this.ensureOpenRouterSource();
      }
    }
  }

  private ensureOpenRouterSource(): void {
    if (this.models.hasSource()) return;
    this.models.setSource(async () => {
      const resolution = this.configService
        ? await this.configService.resolveFor('openrouter', null)
        : null;
      const baseUrl = resolution?.baseUrl ?? getEnv().OPENROUTER_BASE_URL;
      const apiKey = resolution?.apiKey ?? getEnv().OPENROUTER_API_KEY;
      const entries = await fetchOpenRouterCatalog(baseUrl, apiKey, getEnv().AI_TIMEOUT_MS);
      const defaultId = resolution?.defaultModelId ?? getEnv().OPENROUTER_DEFAULT_MODEL;
      return entries.map((entry) => toModelDescriptor(entry, entry.id === defaultId));
    }, getEnv().OPENROUTER_CATALOG_TTL_MS);
  }

  private withModel<T extends { modelId?: string }>(params: T, candidate: ResolvedCandidate): T {
    if (!candidate.modelId || params.modelId === candidate.modelId) return params;
    return { ...params, modelId: candidate.modelId };
  }

  private async withFallback<T>(
    capability: AICapability,
    params: { modelId?: string },
    options: ExecuteOptions,
    invoke: (candidate: ResolvedCandidate) => Promise<T>,
  ): Promise<T> {
    const strategy = options.strategy ?? this.strategy;
    await this.syncConfiguredProviders();

    let candidates: ResolvedCandidate[];
    if (options.providerId) {
      const instance = await this.resolveProviderInstance(options.providerId, options.workspaceId);
      if (!instance) {
        throw new AppError('No AI provider is configured', 503, 'AI_PROVIDER_UNAVAILABLE');
      }
      let modelId: string | null = null;
      if (params.modelId) {
        const descriptor = await this.models.resolveWithRefresh(params.modelId);
        if (!descriptor || descriptor.provider !== options.providerId) {
          throw new AppError(`Model "${params.modelId}" is not available`, 503, 'AI_MODEL_UNAVAILABLE');
        }
        modelId = descriptor.id;
      }
      candidates = [{ provider: instance, modelId }];
    } else {
      if (params.modelId) {
        const descriptor = await this.models.resolveWithRefresh(params.modelId);
        if (!descriptor) {
          throw new AppError(`Model "${params.modelId}" is not available`, 503, 'AI_MODEL_UNAVAILABLE');
        }
      } else {
        await this.models.refreshIfStale();
      }
      candidates = this.resolver.rank(strategy, capability, options);
    }

    const first = candidates[0]!;
    try {
      return await invoke(first);
    } catch (err) {
      const automatic = !options.providerId && !params.modelId;
      if (!automatic || candidates.length < 2) throw err;

      const next = candidates[1]!;
      try {
        return await invoke(next);
      } catch (retryErr) {
        if (retryErr instanceof AppError && err instanceof AppError) {
          throw new AppError(retryErr.message, retryErr.statusCode, retryErr.code, {
            ...retryErr.details,
            originalError: { code: err.code, status: err.statusCode, message: err.message },
          });
        }
        throw retryErr;
      }
    }
  }

  private async resolveProviderInstance(providerId: string, workspaceId?: string): Promise<IAIProvider | null> {
    const resolution = await this.getProviderConfig(providerId, workspaceId);
    if (!resolution || resolution.state !== 'enabled' || !resolution.apiKey) return null;
    if (resolution.source === 'workspace' || !this.providers.has(providerId)) {
      return this.configService!.buildInstance(resolution);
    }
    return this.providers.get(providerId);
  }
}
