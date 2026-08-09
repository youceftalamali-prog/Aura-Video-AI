import { getEnv } from '@aura/config';
import type { IAIProvider } from '../interfaces/ai-provider.interface.js';
import { OpenAIProvider } from './openai.provider.js';
import type { IUrlMetadataExtractor } from '../interfaces/url-extractor.interface.js';
import { HtmlUrlMetadataExtractor } from './html-url-extractor.js';

let aiProvider: IAIProvider | null = null;
let urlExtractor: IUrlMetadataExtractor | null = null;

export function getAIProvider(): IAIProvider {
  if (!aiProvider) {
    const env = getEnv();
    if (env.AI_PROVIDER === 'openai' || env.AI_PROVIDER === 'openai_compatible') {
      aiProvider = new OpenAIProvider();
    } else {
      aiProvider = new OpenAIProvider();
    }
  }
  return aiProvider;
}

export function getUrlMetadataExtractor(): IUrlMetadataExtractor {
  if (!urlExtractor) {
    urlExtractor = new HtmlUrlMetadataExtractor();
  }
  return urlExtractor;
}

export function resetAIProviders(): void {
  aiProvider = null;
  urlExtractor = null;
}

export { OpenAIProvider } from './openai.provider.js';
export { HtmlUrlMetadataExtractor } from './html-url-extractor.js';
