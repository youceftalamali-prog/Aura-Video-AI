import { z } from 'zod';

export const estimateBodySchema = z.object({
  duration: z.number().positive().max(180),
  sceneCount: z.number().int().positive().max(30),
  mode: z.enum(['text_to_video', 'image_to_video', 'storyboard']),
});

export const topUpBodySchema = z.object({
  amount: z.number().int().positive().max(1_000_000),
});

export const workspaceUpdateSchema = z.object({
  name: z.string().min(1).max(100),
});


export const subscriptionCheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'business']),
});

export const creditsCheckoutSchema = z.object({
  package: z.enum(['small', 'medium', 'large']),
});
