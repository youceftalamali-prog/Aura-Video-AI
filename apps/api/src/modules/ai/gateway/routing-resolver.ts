import { AppError } from '@aura/shared';
import type { AICapability, ModelDescriptor, RoutingStrategy } from '@aura/types';
import type { IAIProvider } from '../interfaces/ai-provider.interface.js';
import type { ModelRegistry } from './model-registry.js';
import type { ProviderRegistry } from './provider-registry.js';

/** A routing decision: the provider to call and the model it must use (null = provider default). */
export interface ResolvedCandidate {
  provider: IAIProvider;
  modelId: string | null;
}

export interface ResolveOptions {
  providerId?: string;
  modelId?: string;
}

/**
 * Resolves a routing strategy + capability to a ranked list of
 * (provider, model) candidates. Ranking uses only real catalog fields:
 *
 * - fast:     lowest combined prompt+completion price first (cheaper models are
 *             typically smaller/faster; the catalog exposes no latency data).
 * - balanced: the registry's configured default model first (OpenRouter's
 *             OPENROUTER_DEFAULT_MODEL when set, otherwise the OpenAI env
 *             model), then providers' isDefault models, then price.
 * - smart:    largest context window first; for structured output the models
 *             advertising structured_outputs/response_format rank first.
 */
export class RoutingResolver {
  constructor(
    private readonly providers: ProviderRegistry,
    private readonly models: ModelRegistry,
    private readonly defaultModelId: string | null = null,
  ) {}

  rank(strategy: RoutingStrategy, capability: AICapability, options: ResolveOptions = {}): ResolvedCandidate[] {
    if (options.modelId) {
      return this.rankExplicit(capability, options);
    }

    const descriptors = this.models
      .list()
      .filter(
        (descriptor) =>
          descriptor.capabilities.includes(capability) &&
          (!options.providerId || descriptor.provider === options.providerId) &&
          this.providers.isRoutable(descriptor.provider),
      );
    if (descriptors.length === 0) {
      throw new AppError('No AI provider is configured', 503, 'AI_PROVIDER_UNAVAILABLE');
    }

    const sorted = [...descriptors].sort(comparatorFor(strategy, capability, this.defaultModelId));
    return sorted.map((descriptor) => ({
      provider: this.providers.get(descriptor.provider),
      modelId: descriptor.id,
    }));
  }

  /**
   * Ranks models for an already-resolved provider instance. This is used for
   * workspace-scoped provider configs that are not registered globally.
   */
  rankForProvider(
    strategy: RoutingStrategy,
    capability: AICapability,
    providerId: string,
    provider: IAIProvider,
    modelId?: string,
  ): ResolvedCandidate[] {
    const descriptors = this.models
      .list()
      .filter((descriptor) => descriptor.provider === providerId && descriptor.capabilities.includes(capability));

    if (modelId) {
      const descriptor = descriptors.find((item) => item.id === modelId);
      if (!descriptor) {
        throw new AppError(
          `Model "${modelId}" is not available for capability "${capability}"`,
          503,
          'AI_MODEL_UNAVAILABLE',
        );
      }
      return [{ provider, modelId: descriptor.id }];
    }

    if (descriptors.length === 0) {
      throw new AppError(`Provider "${providerId}" does not support capability "${capability}"`, 503, 'AI_PROVIDER_UNAVAILABLE');
    }

    return [...descriptors]
      .sort(comparatorFor(strategy, capability, this.defaultModelId))
      .map((descriptor) => ({ provider, modelId: descriptor.id }));
  }

  private rankExplicit(capability: AICapability, options: ResolveOptions): ResolvedCandidate[] {
    const descriptor = this.models.resolve(options.modelId!);
    if (!descriptor || !descriptor.capabilities.includes(capability)) {
      throw new AppError(
        `Model "${options.modelId}" is not available for capability "${capability}"`,
        503,
        'AI_MODEL_UNAVAILABLE',
      );
    }
    if (options.providerId && descriptor.provider !== options.providerId) {
      throw new AppError(
        `Model "${options.modelId}" is not available on provider "${options.providerId}"`,
        503,
        'AI_MODEL_UNAVAILABLE',
      );
    }
    if (!this.providers.isRoutable(descriptor.provider)) {
      throw new AppError(`Provider "${descriptor.provider}" is unavailable`, 503, 'AI_PROVIDER_UNAVAILABLE');
    }
    return [{ provider: this.providers.get(descriptor.provider), modelId: descriptor.id }];
  }

  /** Backward-compatible single-provider resolution (first ranked candidate). */
  resolve(strategy: RoutingStrategy, capability: AICapability, options: ResolveOptions = {}): IAIProvider {
    return this.rank(strategy, capability, options)[0]!.provider;
  }
}

function totalPrice(descriptor: ModelDescriptor): number {
  return (descriptor.promptPrice ?? 0) + (descriptor.completionPrice ?? 0);
}

/** Known combined price, or null when pricing is not advertised. */
function knownPrice(descriptor: ModelDescriptor): number | null {
  if (descriptor.promptPrice === undefined || descriptor.completionPrice === undefined) return null;
  return descriptor.promptPrice + descriptor.completionPrice;
}

function comparatorFor(strategy: RoutingStrategy, capability: AICapability, defaultModelId: string | null) {
  switch (strategy) {
    case 'fast':
      return (a: ModelDescriptor, b: ModelDescriptor) => {
        const aPrice = knownPrice(a);
        const bPrice = knownPrice(b);
        if (aPrice === null && bPrice === null) {
          return (a.contextWindow ?? 0) - (b.contextWindow ?? 0);
        }
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return aPrice - bPrice || (a.contextWindow ?? 0) - (b.contextWindow ?? 0);
      };
    case 'balanced':
      return (a: ModelDescriptor, b: ModelDescriptor) =>
        Number(b.id === defaultModelId) - Number(a.id === defaultModelId) ||
        Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) ||
        totalPrice(a) - totalPrice(b);
    case 'smart':
      return (a: ModelDescriptor, b: ModelDescriptor) => {
        if (capability === 'generate-structured') {
          const aStruct = Number(Boolean(a.supportsStructuredOutputs));
          const bStruct = Number(Boolean(b.supportsStructuredOutputs));
          if (aStruct !== bStruct) return bStruct - aStruct;
        }
        return (b.contextWindow ?? 0) - (a.contextWindow ?? 0) || totalPrice(a) - totalPrice(b);
      };
  }
}
