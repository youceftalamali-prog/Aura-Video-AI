import { z } from 'zod';
import { aspectRatioSchema, storyboardSceneSchema, adScriptSceneSchema } from '../../creative/dto/schemas.js';

export const videoSceneInputSchema = z.object({
  order: z.number().int().min(1),
  duration: z.number().positive().max(60),
  visualPrompt: z.string().min(1).max(2000),
  narration: z.string().max(1000).optional(),
  onScreenText: z.string().max(300).optional(),
  cameraDirection: z.string().max(300).optional(),
  imageUrl: z.string().url().max(2048).optional(),
  motion: z.string().max(300).optional(),
  transition: z.string().max(100).optional(),
});

export const videoGenerateBodySchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  aspectRatio: aspectRatioSchema,
  duration: z.number().positive().max(120),
  scenes: z.array(videoSceneInputSchema).min(1).max(20),
  storyboard: z.array(storyboardSceneSchema).optional(),
  scriptScenes: z.array(adScriptSceneSchema).optional(),
  mode: z.enum(['text_to_video', 'image_to_video', 'storyboard']).optional(),
  sourceImageUrl: z.string().url().max(2048).optional(),
  style: z.string().max(200).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const estimateCostBodySchema = videoGenerateBodySchema.pick({
  duration: true,
  scenes: true,
  mode: true,
  sourceImageUrl: true,
});
