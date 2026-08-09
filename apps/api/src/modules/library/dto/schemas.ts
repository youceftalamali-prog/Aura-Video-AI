import { z } from 'zod';

export const createProjectBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  templateId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

export const updateProjectBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['draft', 'processing', 'completed', 'failed', 'archived']).optional(),
  thumbnailUrl: z.string().url().max(2048).nullable().optional(),
  videoUrl: z.string().url().max(2048).nullable().optional(),
  durationSeconds: z.number().positive().max(600).nullable().optional(),
  resolution: z.string().max(20).nullable().optional(),
});
