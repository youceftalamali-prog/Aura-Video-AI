import type { UUID } from './common';

export type AIIntentType =
  | 'ANALYZE_PRODUCT'
  | 'CREATE_PRODUCT_AD'
  | 'CREATE_VIDEO'
  | 'CREATE_IMAGE'
  | 'SELECT_TEMPLATE'
  | 'EDIT_AD'
  | 'EXPORT_VIDEO'
  | 'UNKNOWN';

export type ProductSourceType = 'url' | 'image' | 'text';

export interface ProductAnalysis {
  productName: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  targetAudience: string[];
  keyBenefits: string[];
  features: string[];
  sellingPoints: string[];
  keywords: string[];
  brandTone: string;
  visualStyle: string;
  callToAction: string;
  suggestedAdAngles: string[];
  confidence: number;
  sourceType: ProductSourceType;
  sourceUrl?: string | null;
  imageUrl?: string | null;
}

export interface ProductUrlMetadata {
  url: string;
  title: string | null;
  description: string | null;
  images: string[];
  siteName: string | null;
  rawTextSnippet: string | null;
}

export interface AnalyzeProductTextInput {
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;
  strategy?: RoutingStrategy;
}

export interface AnalyzeProductUrlInput {
  url: string;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;
  strategy?: RoutingStrategy;
}

export interface AnalyzeProductImageInput {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  name?: string;
  description?: string;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;
  strategy?: RoutingStrategy;
}

export interface AIAssistantInput {
  message: string;
  productId?: UUID;
  productAnalysis?: ProductAnalysis;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;
  strategy?: RoutingStrategy;
}

export interface AIIntent {
  intent: AIIntentType;
  productId: UUID | null;
  requestedFormat: 'video' | 'image' | 'ad' | 'analysis' | null;
  style: string | null;
  duration: number | null;
  language: string | null;
  nextAction: string | null;
  confidence: number;
  summary: string;
}

export interface AIAssistantResponse {
  intent: AIIntent;
  product: ProductAnalysis | null;
  recommendedNextStep: string;
  message: string;
}

// ===== AI Gateway (Phase A) =====

/** Routing strategy used by the AI gateway to select a provider/model. */
export type RoutingStrategy = 'fast' | 'balanced' | 'smart';

/** Abstract AI capability a provider must support. */
export type AICapability =
  | 'analyze-text'
  | 'analyze-image'
  | 'analyze-product'
  | 'generate-structured';

/** Describes a model available through the AI gateway. */
export interface ModelDescriptor {
  id: string;
  provider: string;
  capabilities: AICapability[];
  aliases?: string[];
  /** Human-readable model name (catalog-provided); falls back to id. */
  displayName?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
  /** Input modalities advertised by the model (e.g. ['text', 'image']). */
  inputModalities?: string[];
  /** Output modalities advertised by the model (e.g. ['text']). */
  outputModalities?: string[];
  /** USD per 1M prompt tokens (0 when unknown). */
  promptPrice?: number;
  /** USD per 1M completion tokens (0 when unknown). */
  completionPrice?: number;
  /** Whether the model advertises structured-output / response_format support. */
  supportsStructuredOutputs?: boolean;
  /** Where the descriptor came from: environment config or a provider catalog. */
  source?: 'env' | 'catalog';
  /** Whether this model is the configured default for its provider. */
  isDefault?: boolean;
}
