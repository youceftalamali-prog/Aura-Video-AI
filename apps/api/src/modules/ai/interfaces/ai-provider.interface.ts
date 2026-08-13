import type { ProductAnalysis, ProductUrlMetadata } from '@aura/types';

export interface AnalyzeTextParams {
  systemPrompt: string;
  userPrompt: string;
  jsonSchemaHint?: string;
  /** Optional explicit model id requested for this call (must exist in the model registry). */
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
  /** Optional explicit model id requested for this call (must exist in the model registry). */
  modelId?: string;
}

export interface GenerateStructuredParams<T> {
  systemPrompt: string;
  userPrompt: string;
  schemaDescription: string;
  parse: (raw: unknown) => T;
  /** Optional explicit model id requested for this call (must exist in the model registry). */
  modelId?: string;
}

export interface AnalyzeImageParams {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  prompt: string;
  systemPrompt?: string;
  /** Optional explicit model id requested for this call (must exist in the model registry). */
  modelId?: string;
}

export interface IAIProvider {
  readonly name: string;

  analyzeText(params: AnalyzeTextParams): Promise<string>;

  analyzeProduct(params: AnalyzeProductParams): Promise<ProductAnalysis>;

  generateStructuredOutput<T>(params: GenerateStructuredParams<T>): Promise<T>;

  analyzeImage?(params: AnalyzeImageParams): Promise<string>;
}
