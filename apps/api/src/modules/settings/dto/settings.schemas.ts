import { z } from 'zod';

export const languageCodeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code')
  .max(10);

export const aiStrategySchema = z.enum(['fast', 'balanced', 'smart']);

export const appearanceSchema = z.enum(['light', 'dark', 'system']);

export const aspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:5']);

export const resolutionSchema = z.enum(['720p', '1080p', '4k']);

export const notificationsPatchSchema = z
  .object({
    emailAlerts: z.boolean().optional(),
    marketing: z.boolean().optional(),
    agentUpdates: z.boolean().optional(),
    billing: z.boolean().optional(),
  })
  .strict();

/** Customer preferences intentionally do not accept a model id. */
export const updateUserPreferencesSchema = z
  .object({
    language: languageCodeSchema.optional(),
    appearance: appearanceSchema.optional(),
    aiStrategy: aiStrategySchema.optional(),
    defaultVideoDuration: z.number().int().min(5).max(120).nullable().optional(),
    defaultAspectRatio: aspectRatioSchema.nullable().optional(),
    defaultResolution: resolutionSchema.nullable().optional(),
    defaultVideoLanguage: languageCodeSchema.nullable().optional(),
    notifications: notificationsPatchSchema.optional(),
  })
  .strict();

/** Workspace members also choose a strategy, never a provider/model id. */
export const updateWorkspaceSettingsSchema = z
  .object({
    workspaceId: z.string().uuid().optional(),
    aiStrategy: aiStrategySchema.optional(),
  })
  .strict();

export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;
