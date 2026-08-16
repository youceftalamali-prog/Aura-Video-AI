import { OpenAIProvider } from '../providers/openai.provider.js';
import type {
  AnalyzeImageParams,
  AnalyzeProductParams,
  AnalyzeTextParams,
  GenerateStructuredParams,
  IAIProvider,
} from '../interfaces/ai-provider.interface.js';
import type { ProductAnalysis } from '@aura/types';

/**
 * Gateway adapter over the existing OpenAI provider.
 * Pass-through delegation: preserves existing behavior exactly.
 */
export class OpenAIProviderAdapter implements IAIProvider {
  readonly name = 'openai';
  readonly provider: OpenAIProvider;

  constructor(provider: OpenAIProvider = new OpenAIProvider()) {
    this.provider = provider;
  }

  analyzeText(params: AnalyzeTextParams): Promise<string> {
    return this.provider.analyzeText(params);
  }

  analyzeProduct(params: AnalyzeProductParams): Promise<ProductAnalysis> {
    return this.provider.analyzeProduct(params);
  }

  generateStructuredOutput<T>(params: GenerateStructuredParams<T>): Promise<T> {
    return this.provider.generateStructuredOutput(params);
  }

  analyzeImage(params: AnalyzeImageParams): Promise<string> {
    return this.provider.analyzeImage(params);
  }
}
