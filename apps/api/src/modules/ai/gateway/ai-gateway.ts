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
import type { ModelAllowlistRepository } from '../repositories/model-allowlist.repository.js';
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
 */
export class AIGateway implements IAIProvider {
  readonly name = 'gateway';

  strategy: RoutingStrategy = 'balanced';

  private syncPromise: Promise<void> | null = null;
  private allowlistSyncPromise: Promise<void> | null = null;
  private allowlistSyncedAt = 0;

  constructor(
    private readonly providers: ProviderRegistry,
    private readonly resolver: RoutingResolver,
    private readonly models: ModelRegistry,
    private readonly configService: ProviderConfigService | null = null,
    private readonly allowlistRepo: ModelAllowlistRepository | null = null,
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

  async getProviderConfig(providerId: string, workspaceId?: string | null): Promise<ProviderResolution | null> {
    await this.syncConfiguredProviders();
    if (!this.configService) return null;
    return this.configService.resolveFor(providerId, workspaceId ?? null);
  }

  async getProviderInstance(providerId: string, workspaceId?: string | null): Promise<IAIProvider | null> {
    const resolution = await this.getProviderConfig(providerId, workspaceId);
    if (!resolution || resolution.state !== 'enabled' || !resolution.apiKey) return null;
    if (resolution.source === 'workspace' || !this.providers.has(providerId)) {
      return this.configService!.buildInstance(resolution);
    }
    return this.providers.get(providerId);
  }

  async listModels(): Promise<ModelDescriptor[]> {
    await this.syncConfiguredProviders();
    await this.models.refreshIfStale();
    await this.syncModelAllowlist();
    return this.models.list();
  }

  async refreshModelsCatalog(): Promise<ModelDescriptor[]> {
    await this.syncConfiguredProviders();
    await this.models.refresh();
    await this.syncModelAllowlist(true);
    return this.models.list();
  }

  async setAllowedModels(providerId: string, modelIds: string[]): Promise<ModelDescriptor[]> {
    if (!this.allowlistRepo) {
      throw new AppError('AI model allowlist is not configured', 503, 'AI_ALLOWLIST_UNAVAILABLE');
    }
    if (providerId !== 'openai' && providerId !== 'openrouter') {
      throw new AppError('Only OpenAI and OpenRouter models can be allowlisted', 400, 'AI_PROVIDER_INVALID');
    }
    if (modelIds.length === 0) {
      throw new AppError('At least one model must be selected', 400, 'AI_MODEL_ALLOWLIST_EMPTY');
    }

    await this.syncConfiguredProviders();
    await this.models.refreshIfStale();
    const available = this.models.all().filter((model) => model.provider === providerId);
    const availableIds = new Set(available.map((model) => model.id));
    const invalid = modelIds.filter((modelId) => !availableIds.has(modelId));
    if (invalid.length > 0) {
      throw new AppError('One or more selected models are unavailable', 400, 'AI_MODEL_UNAVAILABLE', { invalid });
    }

    await this.allowlistRepo.replace(providerId, [...new Set(modelIds)]);
    await this.syncModelAllowlist(true);
    return this.models.list();
  }

  async getRegistryStatus(): Promise<{
    providers: Record<string, ProviderAvailability>;
    models: ReturnType<ModelRegistry['status']>;
  }> {
    await this.syncConfiguredProviders();
    await this.syncModelAllowlist();
    const providers: Record<string, ProviderAvailability> = {};
    for (const provider of this.providers.all()) {
      providers[provider.name] = this.providers.availabilityOf(provider.name);
    }
    return { providers, models: this.models.status() };
  }

  async syncConfiguredProviders(): Promise<void> {
    if (!this.configService) return;
    if (!this.syncPromise) {
      this.syncPromise = this.doSync().finally(() => {
        this.syncPromise = null;
      });
    }
    return this.syncPromise;
  }

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

  private async syncModelAllowlist(force = false): Promise<void> {
    if (!this.allowlistRepo) return;
    if (!force && Date.now() - this.allowlistSyncedAt < 5000) return;
    if (!this.allowlistSyncPromise) {
      this.allowlistSyncPromise = this.allowlistRepo
        .list()
        .then((entries) => {
          this.models.setAllowlist(entries);
          this.allowlistSyncedAt = Date.now();
        })
        .finally(() => {
          this.allowlistSyncPromise = null;
        });
    }
    await this.allowlistSyncPromise;
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
    await this.syncModelAllowlist();

    let candidates: ResolvedCandidate[];
    if (options.providerId) {
      const instance = await this.resolveProviderInstance(options.providerId, options.workspaceId);
      if (!instance) {
        throw new AppError('No AI provider is configured', 503, 'AI_PROVIDER_UNAVAILABLE');
      }

      let requestedModelId: string | undefined;
      if (params.modelId) {
        const descriptor = await this.models.resolveWithRefresh(params.modelId);
        if (!descriptor || descriptor.provider !== options.providerId) {
          throw new AppError(`Model "${params.modelId}" is not available`, 503, 'AI_MODEL_UNAVAILABLE');
        }
        requestedModelId = descriptor.id;
      } else {
        await this.models.refreshIfStale();
      }

      candidates = this.resolver.rankForProvider(
        strategy,
        capability,
        options.providerId,
        instance,
        requestedModelId,
      );
    } else {
      if (params.modelId) {
        const descriptor = await this.models.resolveWithRefresh(params.modelId);
        if (!descriptor) {
          throw new AppError(`Model "${params.modelId}" is not available`, 503, 'AI_MODEL_UNAVAILABLE');
        }
      } else {
        await this.models.refreshIfStale();
      }
      candidates = this.resolver.rank(strategy, capability, { ...options, modelId: params.modelId });
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
