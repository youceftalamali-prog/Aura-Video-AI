import type { UUID, ISODateString, Timestamps } from './common';
import type { AspectRatio, AdScriptScene, StoryboardScene } from './creative';

export type VideoJobStatus =
  | 'queued'
  | 'processing'
  | 'composing'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'canceled';

export type VideoGenerationMode = 'text_to_video' | 'image_to_video' | 'storyboard';

export type MediaProviderName =
  | 'openai'
  | 'fal'
  | 'runway'
  | 'kling'
  | 'veo'
  | 'google'
  | 'none';

export interface VideoGenerationSceneInput {
  order: number;
  duration: number;
  visualPrompt: string;
  narration?: string;
  onScreenText?: string;
  cameraDirection?: string;
  imageUrl?: string;
  motion?: string;
  transition?: string;
}

export interface VideoGenerationRequest {
  projectId: UUID;
  templateId?: UUID;
  aspectRatio: AspectRatio;
  duration: number;
  scenes: VideoGenerationSceneInput[];
  storyboard?: StoryboardScene[];
  scriptScenes?: AdScriptScene[];
  mode?: VideoGenerationMode;
  sourceImageUrl?: string;
  style?: string;
  idempotencyKey?: string;

  language?: string;
  contentLanguage?: string;
  videoLanguage?: string;
  aiOutputLanguage?: string;}

export interface VideoCostEstimate {
  credits: number;
  duration: number;
  sceneCount: number;
  mode: VideoGenerationMode;
  breakdown: { item: string; credits: number }[];
}

export interface VideoGenerationJob extends Timestamps {
  id: UUID;
  workspaceId: UUID;
  projectId: UUID;
  userId: UUID;
  provider: MediaProviderName;
  providerJobId: string | null;
  status: VideoJobStatus;
  progress: number | null;
  currentStage: string | null;
  prompt: string | null;
  input: Record<string, unknown>;
  outputUrl: string | null;
  assetId: UUID | null;
  error: string | null;
  creditsCharged: number;
  idempotencyKey: string | null;
  completedAt: ISODateString | null;
}

export interface VideoGenerationJobPublic {
  id: UUID;
  status: VideoJobStatus;
  progress: number | null;
  currentStage: string | null;
  provider: MediaProviderName;
  outputUrl: string | null;
  assetId: UUID | null;
  error: string | null;
  projectId: UUID;
  creditsCharged: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  completedAt: ISODateString | null;
}

export interface CreateVideoJobResult {
  jobId: UUID;
  status: VideoJobStatus;
  creditsCharged: number;
}

export interface MediaGenerateVideoParams {
  prompt: string;
  aspectRatio: AspectRatio;
  duration: number;
  scenes: VideoGenerationSceneInput[];
  mode?: VideoGenerationMode;
  sourceImageUrl?: string;
  style?: string;
  metadata?: Record<string, unknown>;
}

export interface MediaGenerateImageParams {
  prompt: string;
  aspectRatio?: AspectRatio;
  metadata?: Record<string, unknown>;
}

export interface MediaJobStatusResult {
  providerJobId: string;
  status: VideoJobStatus;
  progress: number | null;
  outputUrl: string | null;
  error: string | null;
}

export interface MediaProviderCapabilities {
  textToVideo: boolean;
  imageToVideo: boolean;
  asyncJobs: boolean;
  cancel: boolean;
}
