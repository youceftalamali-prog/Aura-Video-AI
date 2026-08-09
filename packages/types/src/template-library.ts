import type { UUID, ISODateString } from './common';
import type { AspectRatio, CreativeStrategy, AdScript, Storyboard } from './creative';
import type { ProductAnalysis } from './ai';
import type { ProductIntelligence } from './product-intelligence';

export interface LibraryTemplateCategory {
  slug: string;
  name: string;
  description: string;
  previewGradient: string;
  templateCount: number;
  sortOrder: number;
}

export interface LibraryTemplateSceneDefinition {
  order: number;
  type: string;
  title: string;
  durationSeconds: number;
  productPlacement?: string;
  textPlaceholder?: string;
  visualPromptTemplate: string;
  transition?: string;
}

export interface LibraryTemplate {
  id: UUID;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  subCategory: string | null;
  thumbnailUrl: string | null;
  previewVideoUrl: string | null;
  hasRealPreview: boolean;
  durationSeconds: number | null;
  aspectRatio: AspectRatio | string;
  creditsCost: number;
  status: string;
  isPremium: boolean;
  isFeatured: boolean;
  sortOrder: number;
  tags: string[];
  scenes: LibraryTemplateSceneDefinition[];
  supportedProductTypes: string[];
  metadata: Record<string, unknown> | null;
  createdAt?: ISODateString;
  updatedAt?: ISODateString;
}

export interface InstantiateTemplateInput {
  productId: UUID;
}

export interface InstantiateTemplateResult {
  templateId: UUID;
  productId: UUID;
  analysis: ProductAnalysis;
  intelligence: ProductIntelligence | null;
  generationConfig: {
    aspectRatio: string;
    duration: number;
    scenes: Array<{
      order: number;
      duration: number;
      visualPrompt: string;
      onScreenText?: string;
      type: string;
    }>;
    styleNotes: string;
  };
}

export interface GenerateFromTemplateInput {
  productId: UUID;
  projectId?: UUID;
  aspectRatio?: AspectRatio;
  duration?: number;
}

export interface GenerateFromTemplateResult {
  templateId: UUID;
  productId: UUID;
  strategy: CreativeStrategy;
  script: AdScript;
  storyboard: Storyboard;
  generationConfig: InstantiateTemplateResult['generationConfig'];
}

export interface TemplateTextOverrides {
  headline?: string;
  subheadline?: string;
  cta?: string;
  brandName?: string;
  sceneTexts?: Record<string, string>;
}

export interface TemplateMediaOverrides {
  productImageUrl?: string;
  logoUrl?: string;
}

export interface TemplateCustomization {
  productId: string;
  textOverrides?: TemplateTextOverrides;
  mediaOverrides?: TemplateMediaOverrides;
  aspectRatio?: AspectRatio;
  brandKitApplied?: boolean;
  sceneDurationOverrides?: Record<number, number>;
}

export interface TemplatePreviewConfig {
  templateId: string;
  productId: string;
  productName: string;
  aspectRatio: string;
  duration: number;
  scenes: Array<{
    order: number;
    type: string;
    title: string;
    duration: number;
    visualPrompt: string;
    onScreenText?: string;
  }>;
  textOverrides: TemplateTextOverrides;
  mediaOverrides: TemplateMediaOverrides;
  brand: {
    brandName: string | null;
    primaryColor: string | null;
    logoUrl: string | null;
  };
  hasRealPreview: boolean;
  previewVideoUrl: string | null;
  previewImageUrl: string | null;
  thumbnailUrl: string | null;
}
