import { z } from 'zod';
import { productAnalysisSchema } from '../../ai/dto/schemas.js';

export const aspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:5']);

export const creativeStrategySceneSchema = z.object({
  order: z.number().int().min(1),
  purpose: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  durationSeconds: z.number().positive().max(60),
});

export const creativeStrategySchema = z.object({
  objective: z.string().min(1).max(500),
  targetAudience: z.array(z.string()).min(1).max(20),
  creativeAngle: z.string().min(1).max(500),
  hook: z.string().min(1).max(500),
  keyMessage: z.string().min(1).max(500),
  tone: z.string().min(1).max(120),
  visualDirection: z.string().min(1).max(1000),
  callToAction: z.string().min(1).max(200),
  suggestedDuration: z.number().positive().max(120),
  suggestedAspectRatio: aspectRatioSchema,
  scenes: z.array(creativeStrategySceneSchema).min(1).max(20),
});

export const adScriptSceneSchema = z.object({
  order: z.number().int().min(1),
  duration: z.number().positive().max(60),
  narration: z.string().max(1000),
  onScreenText: z.string().max(300),
  visualDescription: z.string().min(1).max(1000),
  transition: z.string().max(100),
});

export const adScriptSchema = z.object({
  duration: z.number().positive().max(120),
  hook: z.string().min(1).max(500),
  scenes: z.array(adScriptSceneSchema).min(1).max(20),
  narration: z.string().max(5000),
  onScreenText: z.string().max(1000),
  visualDescription: z.string().max(5000),
  transition: z.string().max(200),
});

export const storyboardSceneSchema = z.object({
  sceneId: z.string().min(1).max(64),
  order: z.number().int().min(1),
  duration: z.number().positive().max(60),
  visualPrompt: z.string().min(1).max(2000),
  cameraDirection: z.string().max(300),
  subject: z.string().max(300),
  background: z.string().max(500),
  lighting: z.string().max(200),
  textOverlay: z.string().max(300),
  audioDirection: z.string().max(300),
});

export const storyboardSchema = z.object({
  duration: z.number().positive().max(120),
  aspectRatio: aspectRatioSchema,
  scenes: z.array(storyboardSceneSchema).min(1).max(20),
});

export const generateStrategyBodySchema = z.object({
  productAnalysis: productAnalysisSchema,
  userRequest: z.string().max(2000).optional(),
  language: z.string().max(20).optional(),
  preferredDuration: z.number().positive().max(120).optional(),
  preferredAspectRatio: aspectRatioSchema.optional(),
});

export const generateScriptBodySchema = z.object({
  productAnalysis: productAnalysisSchema,
  creativeStrategy: creativeStrategySchema,
  language: z.string().max(20).optional(),
});

export const generateStoryboardBodySchema = z.object({
  adScript: adScriptSchema,
  creativeStrategy: creativeStrategySchema,
  aspectRatio: aspectRatioSchema.optional(),
});

export const recommendTemplateBodySchema = z.object({
  productAnalysis: productAnalysisSchema,
  creativeStrategy: creativeStrategySchema,
  limit: z.number().int().min(1).max(20).optional().default(5),
});
