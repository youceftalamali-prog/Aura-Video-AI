import { getEnv } from '@aura/config';
import type { ModelDescriptor } from '@aura/types';
import { getDb } from '../../../db/client.js';
import { TokenCryptoService } from '../../publishing/services/token-crypto.service.js';
import { OpenAIProvider } from '../providers/openai.provider.js';
import { OpenRouterProvider } from '../providers/openrouter.provider.js';
import { DbProviderConfigRepository, type ProviderConfigRepository } from '../repositories/provider-config.repository.js';
import {
  DbModelAllowlistRepository,
  type ModelAllowlistRepository,
} from '../repositories/model-allowlist.repository.js';
import { ProviderConfigService } from '../services/provider-config.service.js';
import { AIGateway } from './ai-gateway.js';
import { ModelRegistry } from './model-registry.js';
import { OpenAIProviderAdapter } from './openai-provider.adapter.js';
import { fetchOpenRouterCatalog, toModelDescriptor } from './openrouter-catalog.js';
import { ProviderRegistry } from './provider-registry.js';
import { RoutingResolver } from './routing-resolver.js';

let aiGateway: AIGateway | null = null;
let gatewayDeps: AIGatewayDeps | null = null;

export interface AIGatewayDeps {
  configService?: ProviderConfigService;
  repo?: ProviderConfigRepository;
  allowlistRepo?: ModelAllowlistRepository;
}

export function createAIGateway(deps: AIGatewayDeps = {}): AIGateway {
  if (aiGateway) {
    return aiGateway;
  }
  gatewayDeps = deps;
  const env = getEnv();
  const configService =
    deps.configService ??
    new ProviderConfigService(deps.repo ?? new DbProviderConfigRepository(getDb()), new TokenCryptoService());
  const allowlistRepo =
    deps.allowlistRepo ??
    (deps.configService || deps.repo ? null : new DbModelAllowlistRepository(getDb()));

  const providers = new ProviderRegistry();
  providers.register(new OpenAIProviderAdapter(new OpenAIProvider()), true);

  const byId = new Map<string, ModelDescriptor>();
  const seed = (descriptor: ModelDescriptor): void => {
    const existing = byId.get(descriptor.id);
    if (existing) {
      existing.capabilities = [...new Set([...existing.capabilities, ...descriptor.capabilities])];
      existing.supportsVision = existing.supportsVision || descriptor.supportsVision;
    } else {
      byId.set(descriptor.id, descriptor);
    }
  };
  seed({
    id: env.AI_MODEL,
    provider: 'openai',
    capabilities: ['analyze-text', 'analyze-product', 'generate-structured'],
    isDefault: true,
    source: 'env',
  });
  seed({
    id: env.AI_VISION_MODEL,
    provider: 'openai',
    capabilities: ['analyze-image', 'analyze-product'],
    supportsVision: true,
    source: 'env',
  });

  const models = new ModelRegistry();
  models.registerMany([...byId.values()]);

  if (env.OPENROUTER_API_KEY) {
    providers.register(new OpenRouterProvider(), false);
    attachOpenRouterSource(models, configService);
  }

  const resolver = new RoutingResolver(providers, models, env.OPENROUTER_DEFAULT_MODEL || env.AI_MODEL);
  aiGateway = new AIGateway(providers, resolver, models, configService, allowlistRepo);
  return aiGateway;
}

/** Catalog source resolves credentials at fetch time so runtime configs take effect. */
function attachOpenRouterSource(models: ModelRegistry, configService: ProviderConfigService): void {
  models.setSource(async () => {
    const env = getEnv();
    const resolution = await configService.resolveFor('openrouter', null);
    const baseUrl = resolution?.baseUrl ?? env.OPENROUTER_BASE_URL;
    const apiKey = resolution?.apiKey ?? env.OPENROUTER_API_KEY;
    const entries = await fetchOpenRouterCatalog(baseUrl, apiKey, env.AI_TIMEOUT_MS);
    const defaultId = resolution?.defaultModelId ?? env.OPENROUTER_DEFAULT_MODEL;
    return entries.map((entry) => toModelDescriptor(entry, entry.id === defaultId));
  }, getEnv().OPENROUTER_CATALOG_TTL_MS);
}

export function getAIGateway(): AIGateway {
  return createAIGateway(gatewayDeps ?? {});
}

export function resetAIGateway(): void {
  aiGateway = null;
  gatewayDeps = null;
}

export { AIGateway, ModelRegistry, OpenAIProviderAdapter, OpenRouterProvider, ProviderRegistry, RoutingResolver };
export type { ExecuteOptions } from './ai-gateway.js';
export { ProviderConfigService } from '../services/provider-config.service.js';
