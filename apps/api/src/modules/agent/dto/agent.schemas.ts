import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  language: z.string().max(20).optional(),
});

export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(8000).trim(),
  strategy: z.enum(['fast', 'balanced', 'smart']).optional(),
  modelId: z.string().max(200).optional(),
  providerId: z.string().max(40).optional(),
  /** Explicit confirmation for a pending credit-spending action (e.g. video.create). */
  confirm: z.boolean().optional(),
});
