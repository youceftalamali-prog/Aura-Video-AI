import { z } from 'zod';

export const routingStrategySchema = z.enum(['fast', 'balanced', 'smart']);

export const productAnalysisSchema = z.object({
  productName: z.string().min(1).max(300),
  shortDescription: z.string().min(1).max(500),
  longDescription: z.string().min(1).max(5000),
  category: z.string().min(1).max(120),
  targetAudience: z.array(z.string()).min(1).max(20),
  keyBenefits: z.array(z.string()).min(1).max(20),
  features: z.array(z.string()).min(1).max(30),
  sellingPoints: z.array(z.string()).min(1).max(20),
  keywords: z.array(z.string()).min(1).max(30),
  brandTone: z.string().min(1).max(120),
  visualStyle: z.string().min(1).max(200),
  callToAction: z.string().min(1).max(200),
  suggestedAdAngles: z.array(z.string()).min(1).max(15),
  confidence: z.number().min(0).max(1),
  sourceType: z.enum(['url', 'image', 'text']),
  sourceUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export type ProductAnalysisDto = z.infer<typeof productAnalysisSchema>;

export const analyzeProductTextBodySchema = z.object({
  name: z.string().min(1).max(300).trim(),
  description: z.string().min(1).max(8000).trim(),
  metadata: z.record(z.unknown()).optional(),
  strategy: routingStrategySchema.optional(),
});

export const analyzeProductUrlBodySchema = z.object({
  url: z
    .string()
    .url()
    .max(2048)
    .refine((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Only http/https URLs are allowed'),
  strategy: routingStrategySchema.optional(),
});

export const analyzeProductImageBodySchema = z
  .object({
    imageUrl: z.string().url().max(2048).optional(),
    imageBase64: z.string().max(8_000_000).optional(),
    mimeType: z.string().max(100).optional(),
    name: z.string().max(300).optional(),
    description: z.string().max(8000).optional(),
    strategy: routingStrategySchema.optional(),
  })
  .refine((d) => !!d.imageUrl || !!d.imageBase64, {
    message: 'Either imageUrl or imageBase64 is required',
  });

export const aiAssistantBodySchema = z.object({
  message: z.string().min(1).max(4000).trim(),
  productId: z.string().uuid().optional(),
  productAnalysis: productAnalysisSchema.optional(),
  language: z.string().max(20).optional(),
  strategy: routingStrategySchema.optional(),
});

export const aiIntentSchema = z.object({
  intent: z.enum([
    'ANALYZE_PRODUCT',
    'CREATE_PRODUCT_AD',
    'CREATE_VIDEO',
    'CREATE_IMAGE',
    'SELECT_TEMPLATE',
    'EDIT_AD',
    'EXPORT_VIDEO',
    'UNKNOWN',
  ]),
  productId: z.string().uuid().nullable(),
  requestedFormat: z.enum(['video', 'image', 'ad', 'analysis']).nullable(),
  style: z.string().nullable(),
  duration: z.number().nullable(),
  language: z.string().nullable(),
  nextAction: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});
