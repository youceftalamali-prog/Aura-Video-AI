import type { IAIProvider } from '../interfaces/ai-provider.interface.js';
import { getAIGateway, resetAIGateway } from '../gateway/index.js';
import type { IUrlMetadataExtractor } from '../interfaces/url-extractor.interface.js';
import { HtmlUrlMetadataExtractor } from './html-url-extractor.js';

let urlExtractor: IUrlMetadataExtractor | null = null;

/**
 * Compatibility entry point for older modules. Every AI call now goes through
 * the gateway so OpenAI/OpenRouter routing, model capability checks, fallback,
 * and runtime provider configuration are applied consistently.
 */
export function getAIProvider(): IAIProvider {
  return getAIGateway();
}

export function getUrlMetadataExtractor(): IUrlMetadataExtractor {
  if (!urlExtractor) {
    const extractor = new HtmlUrlMetadataExtractor();
    urlExtractor = extractor;
    return extractor;
  }
  return urlExtractor;
}

export function resetAIProviders(): void {
  urlExtractor = null;
  resetAIGateway();
}

export { OpenAIProvider } from './openai.provider.js';
export { OpenRouterProvider } from './openrouter.provider.js';
export { HtmlUrlMetadataExtractor } from './html-url-extractor.js';
