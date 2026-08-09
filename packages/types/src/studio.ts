import type { UUID, ISODateString } from './common';
import type { AspectRatio } from './creative';

export type TemplatePlatform =
  | 'tiktok'
  | 'instagram_reels'
  | 'youtube_shorts'
  | 'instagram_feed'
  | 'facebook_ads'
  | 'product_ad'
  | 'ugc'
  | 'showcase'
  | 'promo'
  | 'before_after'
  | 'sale';

export type SceneType =
  | 'hook'
  | 'problem'
  | 'product'
  | 'benefits'
  | 'social_proof'
  | 'cta'
  | 'custom';

export type TextAnimation = 'none' | 'fade_in' | 'fade_out' | 'slide' | 'scale' | 'pop';

export interface TemplateSceneDefinition {
  order: number;
  type: SceneType;
  durationSeconds: number;
  productPosition?: 'center' | 'left' | 'right' | 'full';
  textPosition?: 'top' | 'center' | 'bottom';
  cta?: boolean;
  typography?: { fontSize?: number; weight?: string; color?: string };
  animation?: TextAnimation;
  transition?: string;
  background?: string;
}

export interface TemplateDefinition {
  id: UUID;
  name: string;
  platform: TemplatePlatform;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  scenes: TemplateSceneDefinition[];
  musicStyle?: string;
  voiceStyle?: string;
  captionsDefault?: boolean;
  metadata?: Record<string, unknown>;
}

export interface BrandKit {
  workspaceId: UUID;
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  ctaStyle: string;
  defaultVoice: string;
  defaultMusicStyle: string;
  defaultAspectRatio: AspectRatio;
  updatedAt?: ISODateString;
}

export interface UpdateBrandKitInput {
  brandName?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  ctaStyle?: string;
  defaultVoice?: string;
  defaultMusicStyle?: string;
  defaultAspectRatio?: AspectRatio;

  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;}

export interface VoiceGenerationRequest {
  text: string;
  voice?: string;
  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  speed?: number;
  tone?: string;
  workspaceId?: UUID;
}

export interface VoiceGenerationResult {
  storageKey: string;
  url: string;
  durationSeconds: number;
  provider: string;
  mimeType: string;
}

export interface MusicTrack {
  id: string;
  name: string;
  style: string;
  durationSeconds: number;
  url: string | null;
  storageKey: string | null;
  isBuiltIn: boolean;
}

export interface MusicMixConfig {
  trackId?: string;
  storageKey?: string;
  volume?: number;
  fadeInSeconds?: number;
  fadeOutSeconds?: number;
  duckUnderVoice?: boolean;
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface CaptionStyle {
  fontSize?: number;
  fontColor?: string;
  position?: 'top' | 'center' | 'bottom';
  animation?: TextAnimation;
}

export interface CaptionTrack {
  segments: CaptionSegment[];
  style: CaptionStyle;
  language?: string;
}

export type SceneJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'canceled';

export interface SceneJobState {
  sceneId: string;
  order: number;
  type: SceneType;
  status: SceneJobStatus;
  duration: number;
  visualPrompt: string;
  providerJobId?: string | null;
  outputUrl?: string | null;
  localPath?: string | null;
  error?: string | null;
}

export interface StudioProjectState {
  projectId: UUID;
  productAnalysis?: Record<string, unknown> | null;
  creativeStrategy?: Record<string, unknown> | null;
  script?: Record<string, unknown> | null;
  storyboard?: Record<string, unknown> | null;
  templateId?: UUID | null;
  brandKit?: BrandKit | null;
  voice?: VoiceGenerationResult | null;
  music?: MusicMixConfig | null;
  captions?: CaptionTrack | null;
  scenes?: SceneJobState[];
  lastJobId?: UUID | null;
  finalAssetId?: UUID | null;
  settings?: Record<string, unknown>;
  updatedAt?: ISODateString;
}
