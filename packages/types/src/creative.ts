import type { UUID } from './common';
import type { ProductAnalysis } from './ai';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface CreativeStrategyScene {
  order: number;
  purpose: string;
  description: string;
  durationSeconds: number;
}

export interface CreativeStrategy {
  objective: string;
  targetAudience: string[];
  creativeAngle: string;
  hook: string;
  keyMessage: string;
  tone: string;
  visualDirection: string;
  callToAction: string;
  suggestedDuration: number;
  suggestedAspectRatio: AspectRatio;
  scenes: CreativeStrategyScene[];
}

export interface AdScriptScene {
  order: number;
  duration: number;
  narration: string;
  onScreenText: string;
  visualDescription: string;
  transition: string;
}

export interface AdScript {
  duration: number;
  hook: string;
  scenes: AdScriptScene[];
  narration: string;
  onScreenText: string;
  visualDescription: string;
  transition: string;
}

export interface StoryboardScene {
  sceneId: string;
  order: number;
  duration: number;
  visualPrompt: string;
  cameraDirection: string;
  subject: string;
  background: string;
  lighting: string;
  textOverlay: string;
  audioDirection: string;
}

export interface Storyboard {
  duration: number;
  aspectRatio: AspectRatio;
  scenes: StoryboardScene[];
}

export type TemplateFit = 'excellent' | 'good' | 'fair' | 'poor';

export interface TemplateRecommendation {
  templateId: UUID;
  score: number;
  reason: string;
  fit: TemplateFit;
  name?: string;
  category?: string;
  thumbnailUrl?: string | null;
  creditsCost?: number;
  aspectRatio?: string;
  durationSeconds?: number | null;
}

export interface GenerateStrategyInput {
  productAnalysis: ProductAnalysis;
  userRequest?: string;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  preferredDuration?: number;
  preferredAspectRatio?: AspectRatio;
}

export interface GenerateScriptInput {
  productAnalysis: ProductAnalysis;
  creativeStrategy: CreativeStrategy;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
}

export interface GenerateStoryboardInput {
  adScript: AdScript;
  creativeStrategy: CreativeStrategy;
  aspectRatio?: AspectRatio;

  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;}

export interface RecommendTemplateInput {
  productAnalysis: ProductAnalysis;
  creativeStrategy: CreativeStrategy;
  limit?: number;

  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;}
