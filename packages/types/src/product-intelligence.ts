import type { UUID, ISODateString } from './common';
import type { ProductAnalysis, RoutingStrategy } from './ai';
import type { CreativeStrategy, AdScript, Storyboard, TemplateRecommendation } from './creative';

export type ProductImportSource = 'url' | 'image' | 'text' | 'existing';

export interface ExtractedProductData {
  name: string | null;
  description: string | null;
  images: string[];
  price: string | null;
  currency: string | null;
  brand: string | null;
  sku: string | null;
  availability: string | null;
  category: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  rawFacts: Record<string, string>;
}

export interface ProductProfile {
  category: string;
  brand: string | null;
  features: string[];
  specifications: string[];
  facts: string[];
}

export interface MarketingProfile {
  primaryBenefit: string;
  secondaryBenefits: string[];
  painPoints: string[];
  objections: string[];
  differentiators: string[];
}

export interface AudienceProfile {
  demographics: string[];
  interests: string[];
  useCases: string[];
  buyingMotivations: string[];
}

export type MarketingAngleType =
  | 'problem_solution'
  | 'product_demo'
  | 'benefits'
  | 'lifestyle'
  | 'social_proof'
  | 'urgency'
  | 'offer'
  | 'comparison';

export interface MarketingAngle {
  type: MarketingAngleType;
  title: string;
  description: string;
  recommended: boolean;
}

export interface ContentRecommendations {
  hooks: string[];
  ctaSuggestions: string[];
  visualStyle: string;
  tone: string;
}

export interface ProductIntelligence {
  productProfile: ProductProfile;
  marketingProfile: MarketingProfile;
  audienceProfile: AudienceProfile;
  sellingPoints: string[];
  marketingAngles: MarketingAngle[];
  contentRecommendations: ContentRecommendations;
  analysis: ProductAnalysis;
  extracted?: ExtractedProductData | null;
  confidence: number;
}

export type HookStyle =
  | 'curiosity'
  | 'problem_solution'
  | 'benefit'
  | 'emotional'
  | 'direct_response'
  | 'ugc'
  | 'demonstration'
  | 'short_form_social';

export interface GeneratedHook {
  style: HookStyle;
  text: string;
  score: number;
}

export interface ProductRecord {
  id: UUID;
  workspaceId: UUID;
  userId: UUID;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageAssetId: UUID | null;
  price: string | null;
  currency: string | null;
  externalId: string | null;
  externalSource: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ImportUrlInput {
  url: string;
  workspaceId?: UUID;
  strategy?: RoutingStrategy;
}

export interface ImportTextInput {
  name: string;
  description: string;
  price?: string;
  currency?: string;
  brand?: string;
  strategy?: RoutingStrategy;
}

export interface ImportImageInput {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  name?: string;
  description?: string;
  strategy?: RoutingStrategy;
}

export interface ProductImportResult {
  product: ProductRecord;
  intelligence: ProductIntelligence;
  extracted: ExtractedProductData | null;
}

export interface CreateVideoFromProductInput {
  productId: UUID;
  angleType?: MarketingAngleType;
  hookText?: string;
  templateId?: UUID;
  duration?: 15 | 30 | 45 | 60;
  platform?: string;
  tone?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
}

export interface CreateVideoFromProductResult {
  productId: UUID;
  analysis: ProductAnalysis;
  intelligence: ProductIntelligence;
  strategy: CreativeStrategy;
  script: AdScript;
  storyboard: Storyboard;
  templateRecommendations: TemplateRecommendation[];
  selectedHook: string | null;
  selectedAngle: MarketingAngle | null;
}
