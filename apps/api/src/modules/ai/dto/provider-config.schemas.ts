import { z } from 'zod';

export const createProviderConfigSchema = z.object({
  providerId: z.string().min(1).max(40),
  workspaceId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
  baseUrl: z.string().url().max(500).nullable().optional(),
  apiKey: z.string().min(1).max(2000).optional(),
  defaultModelId: z.string().max(200).nullable().optional(),
  capabilities: z.array(z.string().max(40)).optional(),
});

export const updateProviderConfigSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().url().max(500).nullable().optional(),
  apiKey: z.string().max(2000).optional(),
  defaultModelId: z.string().max(200).nullable().optional(),
  capabilities: z.array(z.string().max(40)).optional(),
});

export const updateModelAllowlistSchema = z.object({
  providerId: z.enum(['openai', 'openrouter']),
  modelIds: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(100)
    .superRefine((modelIds, context) => {
      if (new Set(modelIds).size !== modelIds.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'modelIds must be unique' });
      }
    }),
});
