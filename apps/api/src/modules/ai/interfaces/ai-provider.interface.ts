import type { ProductAnalysis, ProductUrlMetadata, RoutingStrategy } from '@aura/types';

export interface AIExecutionOptions {
  /** Customer-visible routing choice. Model and provider remain server-controlled. */
  strategy?: RoutingStrategy;
}

export interface AnalyzeTextParams {
  systemPrompt: string;
  userPrompt: string;
  jsonSchemaHint?: string;
  /** Optional explicit model id requested for this call (gateway/internal use only). */
  modelId?: string;
}

export interface AnalyzeProductParams {
  name?: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  extractedMeta?: ProductUrlMetadata | null;
  /** Optional explicit model id requested for this call (gateway/internal use only). */
  modelId?: string;
}

export interface GenerateStructuredParams<T> {
  systemPrompt: string;
  userPrompt: string;
  schemaDescription: string;
  parse: (raw: unknown) => T;
  /** Optional explicit model id requested for this call (gateway/internal use only). */
  modelId?: string;
}

export interface AnalyzeImageParams {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  prompt: string;
  systemPrompt?: string;
  /** Optional explicit model id requested for this call (gateway/internal use only). */
  modelId?: string;
}

export interface IAIProvider {
  readonly name: string;

  analyzeText(params: AnalyzeTextParams, options?: AIExecutionOptions): Promise<string>;

  analyzeProduct(params: AnalyzeProductParams, options?: AIExecutionOptions): Promise<ProductAnalysis>;

  generateStructuredOutput<T>(params: GenerateStructuredParams<T>, options?: AIExecutionOptions): Promise<T>;

  analyzeImage?(params: AnalyzeImageParams, options?: AIExecutionOptions): Promise<string>;
}
