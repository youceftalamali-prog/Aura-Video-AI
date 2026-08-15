import { z } from 'zod';

export const routingStrategySchema = z.enum(['fast', 'balanced', 'smart']);

export const importUrlSchema = z.object({
  url: z.string().url().max(2048),
  strategy: routingStrategySchema.optional(),
});

export const importTextSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  price: z.string().max(40).optional(),
  currency: z.string().max(3).optional(),
  brand: z.string().max(100).optional(),
  strategy: routingStrategySchema.optional(),
});

export const importImageSchema = z.object({
  imageUrl: z.string().url().max(2048).optional(),
  imageBase64: z.string().max(5_000_000).optional(),
  mimeType: z.string().max(100).optional(),
  name: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  strategy: routingStrategySchema.optional(),
}).refine((d) => d.imageUrl || d.imageBase64, { message: 'imageUrl or imageBase64 required' });

export const refreshIntelligenceSchema = z.object({
  strategy: routingStrategySchema.optional(),
});

export const createVideoFromProductSchema = z.object({
  productId: z.string().uuid(),
  angleType: z
    .enum([
      'problem_solution',
      'product_demo',
      'benefits',
      'lifestyle',
      'social_proof',
      'urgency',
      'offer',
      'comparison',
    ])
    .optional(),
  hookText: z.string().max(500).optional(),
  templateId: z.string().uuid().optional(),
  duration: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional(),
  platform: z.string().max(40).optional(),
  tone: z.string().max(40).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
});
