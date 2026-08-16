import { getEnv } from '@aura/config';
import { AppError } from '@aura/shared';
import { OpenAIProvider, type ProviderRuntimeConfig } from './openai.provider.js';

/**
 * OpenRouter provider (OpenAI-compatible chat completions).
 * Only credential/base-url/model resolution differs from the base provider;
 * prompt building, schema validation and response handling are inherited.
 * Runtime config (DB provider configs) overrides the OPENROUTER_* env values.
 * Excluded from the gateway entirely when no config and no key exist.
 */
export class OpenRouterProvider extends OpenAIProvider {
  readonly name = 'openrouter';

  constructor(config: ProviderRuntimeConfig = {}) {
    super(config);
  }

  protected get apiKey(): string {
    const key = this.config.apiKey ?? getEnv().OPENROUTER_API_KEY;
    if (!key) {
      throw new AppError(
        'OpenRouter provider is not configured. Set OPENROUTER_API_KEY or save a provider config with an API key.',
        503,
        'AI_NOT_CONFIGURED',
      );
    }
    return key;
  }

  protected get baseUrl(): string {
    return (this.config.baseUrl ?? getEnv().OPENROUTER_BASE_URL).replace(/\/$/, '');
  }

  protected get model(): string {
    const model = this.config.defaultModelId ?? getEnv().OPENROUTER_DEFAULT_MODEL;
    if (!model) {
      throw new AppError(
        'OpenRouter provider has no default model. Set OPENROUTER_DEFAULT_MODEL, configure defaultModelId, or request an explicit modelId.',
        503,
        'AI_MODEL_UNAVAILABLE',
      );
    }
    return model;
  }

  protected get visionModel(): string {
    return this.model;
  }
}
