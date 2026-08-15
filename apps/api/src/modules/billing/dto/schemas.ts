import { z } from 'zod';

export const estimateBodySchema = z.object({
  duration: z.number().positive().max(180),
  sceneCount: z.number().int().positive().max(30),
  mode: z.enum(['text_to_video', 'image_to_video', 'storyboard']),
}).strict();

export const topUpBodySchema = z.object({
  amount: z.number().int().positive().max(1_000_000).optional(),
  package: z.enum(['small', 'medium', 'large']).optional(),
}).strict().refine((value) => value.amount !== undefined || value.package !== undefined, {
  message: 'Either amount or package is required',
});

export const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
}).strict();

export const subscriptionCheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
}).strict();

export const creditsCheckoutSchema = z.object({
  package: z.enum(['small', 'medium', 'large']),
}).strict();
