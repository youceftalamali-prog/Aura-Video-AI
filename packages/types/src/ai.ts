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
  aiOutputLanguage?: string;}

export interface AnalyzeProductUrlInput {
  url: string;

  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;}

export interface AnalyzeProductImageInput {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  name?: string;
  description?: string;

  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;}

export interface AIAssistantInput {
  message: string;
  productId?: UUID;
  productAnalysis?: ProductAnalysis;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;
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
