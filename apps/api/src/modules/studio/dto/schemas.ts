import { z } from 'zod';

export const brandKitUpdateSchema = z.object({
  brandName: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  fontFamily: z.string().max(80).optional(),
  ctaStyle: z.string().max(40).optional(),
  defaultVoice: z.string().max(40).optional(),
  defaultMusicStyle: z.string().max(40).optional(),
  defaultAspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
});

export const voiceBodySchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().max(40).optional(),
  language: z.string().max(20).optional(),
  speed: z.number().min(0.5).max(2).optional(),
  tone: z.string().max(40).optional(),
  workspaceId: z.string().uuid().optional(),
});

export const captionsFromTextSchema = z.object({
  text: z.string().min(1).max(8000),
  totalDuration: z.number().positive().max(180),
  style: z
    .object({
      fontSize: z.number().optional(),
      fontColor: z.string().optional(),
      position: z.enum(['top', 'center', 'bottom']).optional(),
      animation: z.enum(['none', 'fade_in', 'fade_out', 'slide', 'scale', 'pop']).optional(),
    })
    .optional(),
});

export const captionsFromAudioSchema = z.object({
  audioUrl: z.string().url().max(2048),
});

export const studioStatePatchSchema = z.object({
  productAnalysis: z.record(z.unknown()).nullable().optional(),
  creativeStrategy: z.record(z.unknown()).nullable().optional(),
  script: z.record(z.unknown()).nullable().optional(),
  storyboard: z.record(z.unknown()).nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  brandKit: z.record(z.unknown()).nullable().optional(),
  voice: z.record(z.unknown()).nullable().optional(),
  music: z.record(z.unknown()).nullable().optional(),
  captions: z.record(z.unknown()).nullable().optional(),
  scenes: z.array(z.record(z.unknown())).optional(),
  lastJobId: z.string().uuid().nullable().optional(),
  finalAssetId: z.string().uuid().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const musicMixSchema = z.object({
  trackId: z.string().optional(),
  storageKey: z.string().optional(),
  volume: z.number().min(0).max(1).optional(),
  fadeInSeconds: z.number().min(0).max(10).optional(),
  fadeOutSeconds: z.number().min(0).max(10).optional(),
  duckUnderVoice: z.boolean().optional(),
});
