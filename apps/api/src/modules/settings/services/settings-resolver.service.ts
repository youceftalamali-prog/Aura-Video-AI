import { SYSTEM_SETTING_KEYS } from '@aura/types';
import type {
  AiStrategy,
  AppearancePreference,
  AspectRatioPreference,
  NotificationPreferences,
  ResolvedSettings,
  ResolutionPreference,
} from '@aura/types';
import type { SettingsRepository } from '../../../domain/repositories/settings.repository.js';
import type { UserPreferencesRepository, UserPreferencesRecord } from '../repositories/user-preferences.repository.js';
import type {
  WorkspaceSettingsRepository,
  WorkspaceSettingsRecord,
} from '../repositories/workspace-settings.repository.js';
import {
  DEFAULT_APPEARANCE,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_LANGUAGE,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_RESOLUTION,
  DEFAULT_STRATEGY,
  DEFAULT_VIDEO_DURATION,
} from './defaults.js';

export interface SettingsResolverContext {
  userId: string;
  workspaceId: string | null;
}

export interface AiPreferenceOverrides {
  model?: string | null;
  strategy?: AiStrategy | null;
}

export interface SettingsResolverOptions {
  envDefaultModel: string | null;
}

/**
 * Single source of truth for how settings resolve.
 * Precedence (highest first): per-request override -> user preferences -> workspace settings -> system (KV) settings -> env / defaults.
 * Used by AIGateway, Agent, customer Settings API and the UIs.
 */
export class SettingsResolver {
  constructor(
    private readonly userPreferences: UserPreferencesRepository,
    private readonly workspaceSettings: WorkspaceSettingsRepository,
    private readonly systemSettings: SettingsRepository,
    private readonly options: SettingsResolverOptions,
  ) {}

  /** Lazily creates the user preferences row (seeded from KV default language), returns it. */
  async ensureUserPreferences(userId: string, seedLanguage?: string): Promise<UserPreferencesRecord> {
    const existing = await this.userPreferences.getByUserId(userId);
    if (existing) return existing;
    const systemLanguage = await this.kvValue<string>(SYSTEM_SETTING_KEYS.defaultLanguage, null);
    return this.userPreferences.create(userId, {
      language: seedLanguage ?? systemLanguage ?? null,
    });
  }

  async ensureWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsRecord> {
    const existing = await this.workspaceSettings.getByWorkspaceId(workspaceId);
    if (existing) return existing;
    return this.workspaceSettings.create(workspaceId);
  }

  async resolveLanguage(userId: string, seedLanguage?: string): Promise<string> {
    const prefs = await this.ensureUserPreferences(userId, seedLanguage);
    const systemLanguage = await this.kvValue<string>(SYSTEM_SETTING_KEYS.defaultLanguage, null);
    return prefs.language ?? seedLanguage ?? systemLanguage ?? DEFAULT_LANGUAGE;
  }

  async resolveAppearance(userId: string): Promise<AppearancePreference> {
    const prefs = await this.ensureUserPreferences(userId);
    return prefs.appearance ?? DEFAULT_APPEARANCE;
  }

  async resolveAi(
    context: SettingsResolverContext,
    overrides: AiPreferenceOverrides = {},
  ): Promise<{ model: string | null; strategy: AiStrategy }> {
    const prefs = await this.ensureUserPreferences(context.userId);
    const workspace = context.workspaceId ? await this.ensureWorkspaceSettings(context.workspaceId) : null;

    const systemModel = await this.kvValue<string>(SYSTEM_SETTING_KEYS.defaultAiModel, null);
    const systemStrategy = await this.kvValue<AiStrategy>(SYSTEM_SETTING_KEYS.defaultAiStrategy, null);

    const model =
      overrides.model !== undefined
        ? overrides.model
        : prefs.defaultAiModel ?? workspace?.defaultAiModel ?? systemModel ?? this.options.envDefaultModel;

    const strategy =
      overrides.strategy ??
      prefs.aiStrategy ??
      workspace?.aiStrategy ??
      systemStrategy ??
      DEFAULT_STRATEGY;

    return { model, strategy };
  }

  async resolveVideoDefaults(context: SettingsResolverContext): Promise<{
    defaultDuration: number;
    defaultAspectRatio: AspectRatioPreference;
    defaultResolution: ResolutionPreference;
    language: string;
  }> {
    const prefs = await this.ensureUserPreferences(context.userId);
    const systemDuration = await this.kvValue<number>(SYSTEM_SETTING_KEYS.defaultVideoDuration, null);
    const systemAspectRatio = await this.kvValue<AspectRatioPreference>(SYSTEM_SETTING_KEYS.defaultAspectRatio, null);
    const language = prefs.defaultVideoLanguage ?? (await this.resolveLanguage(context.userId));

    return {
      defaultDuration: prefs.defaultVideoDuration ?? systemDuration ?? DEFAULT_VIDEO_DURATION,
      defaultAspectRatio: prefs.defaultAspectRatio ?? systemAspectRatio ?? DEFAULT_ASPECT_RATIO,
      defaultResolution: prefs.defaultResolution ?? DEFAULT_RESOLUTION,
      language,
    };
  }

  async resolveNotifications(userId: string): Promise<NotificationPreferences> {
    const prefs = await this.ensureUserPreferences(userId);
    return { ...DEFAULT_NOTIFICATIONS, ...(prefs.notifications ?? {}) };
  }

  async resolveAll(
    context: SettingsResolverContext,
    overrides: AiPreferenceOverrides = {},
    seedLanguage?: string,
  ): Promise<ResolvedSettings> {
    const [prefs, workspace] = await Promise.all([
      this.ensureUserPreferences(context.userId, seedLanguage),
      context.workspaceId ? this.ensureWorkspaceSettings(context.workspaceId) : Promise.resolve(null),
    ]);

    const [systemModel, systemStrategy, systemLanguage, systemDuration, systemAspectRatio] = await Promise.all([
      this.kvValue<string>(SYSTEM_SETTING_KEYS.defaultAiModel, null),
      this.kvValue<AiStrategy>(SYSTEM_SETTING_KEYS.defaultAiStrategy, null),
      this.kvValue<string>(SYSTEM_SETTING_KEYS.defaultLanguage, null),
      this.kvValue<number>(SYSTEM_SETTING_KEYS.defaultVideoDuration, null),
      this.kvValue<AspectRatioPreference>(SYSTEM_SETTING_KEYS.defaultAspectRatio, null),
    ]);

    const resolvedModel =
      overrides.model !== undefined
        ? overrides.model
        : prefs.defaultAiModel ?? workspace?.defaultAiModel ?? systemModel ?? this.options.envDefaultModel;
    const resolvedStrategy =
      overrides.strategy ?? prefs.aiStrategy ?? workspace?.aiStrategy ?? systemStrategy ?? DEFAULT_STRATEGY;
    const resolvedLanguage = prefs.language ?? seedLanguage ?? systemLanguage ?? DEFAULT_LANGUAGE;

    return {
      language: resolvedLanguage,
      appearance: prefs.appearance ?? DEFAULT_APPEARANCE,
      ai: { model: resolvedModel, strategy: resolvedStrategy },
      video: {
        defaultDuration: prefs.defaultVideoDuration ?? systemDuration ?? DEFAULT_VIDEO_DURATION,
        defaultAspectRatio: prefs.defaultAspectRatio ?? systemAspectRatio ?? DEFAULT_ASPECT_RATIO,
        defaultResolution: prefs.defaultResolution ?? DEFAULT_RESOLUTION,
        language: prefs.defaultVideoLanguage ?? resolvedLanguage,
      },
      notifications: { ...DEFAULT_NOTIFICATIONS, ...(prefs.notifications ?? {}) },
    };
  }

  private async kvValue<T>(key: string, fallback: T | null): Promise<T | null> {
    const value = await this.systemSettings.get(key);
    return (value as T | undefined) ?? fallback;
  }
}