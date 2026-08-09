import { z } from 'zod';

export const emailSchema = z.string().email().max(255).toLowerCase().trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().min(2).max(100).trim(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export const createProjectSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  templateId: uuidSchema.optional(),
  productId: uuidSchema.optional(),
});

export const createProductSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional(),
  imageAssetId: uuidSchema.optional(),
  price: z.string().optional(),
  currency: z.string().length(3).optional(),
  externalId: z.string().max(255).optional(),
  externalSource: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});
