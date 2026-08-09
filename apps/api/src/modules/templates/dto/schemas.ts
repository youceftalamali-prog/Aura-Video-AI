import { z } from 'zod';

export const listTemplatesQuerySchema = z.object({
  category: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  featured: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  aspectRatio: z.string().max(20).optional(),
});

export const instantiateBodySchema = z.object({
  productId: z.string().uuid(),
});

export const generateBodySchema = z.object({
  productId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
  duration: z.number().positive().max(120).optional(),
});


export const customizeBodySchema = z.object({
  productId: z.string().uuid(),
  textOverrides: z
    .object({
      headline: z.string().max(200).optional(),
      subheadline: z.string().max(500).optional(),
      cta: z.string().max(100).optional(),
      brandName: z.string().max(100).optional(),
      sceneTexts: z.record(z.string().max(300)).optional(),
    })
    .optional(),
  mediaOverrides: z
    .object({
      productImageUrl: z.string().url().max(2048).optional(),
      logoUrl: z.string().url().max(2048).optional(),
    })
    .optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
  brandKitApplied: z.boolean().optional(),
  sceneDurationOverrides: z.record(z.coerce.number().positive().max(60)).optional(),
});
