import { z } from 'zod';

export const createProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  templateId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

// Rendered output fields are server-owned. Clients may rename, describe, or
// archive a project, but cannot mark arbitrary URLs as generated output.
export const updateProjectBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.literal('archived').optional(),
});

export const assetTypeSchema = z.enum(['image', 'video', 'audio', 'document', 'other']);
