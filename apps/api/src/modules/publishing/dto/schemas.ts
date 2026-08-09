import { z } from 'zod';

export const platformSchema = z.enum(['youtube', 'instagram', 'facebook', 'tiktok']);

export const connectCallbackSchema = z.object({
  code: z.string().min(1).max(2000),
  state: z.string().max(200).optional(),
});

export const validatePublishSchema = z.object({
  assetId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

export const publishSchema = z.object({
  assetId: z.string().uuid(),
  connectionId: z.string().uuid(),
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
  platformOptions: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
  idempotencyKey: z.string().min(8).max(128),
  projectId: z.string().uuid().optional(),
});
