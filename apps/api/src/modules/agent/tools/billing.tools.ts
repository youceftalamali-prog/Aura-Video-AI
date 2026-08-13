import { z } from 'zod';
import type { BillingService } from '../../billing/services/billing.service.js';
import type { SettingsRepository } from '../../../domain/repositories/settings.repository.js';
import type { AgentToolDefinition } from './agent-tool.js';

export interface BillingToolDeps {
  billing: Pick<BillingService, 'getBalance'>;
}

export interface SettingsToolDeps {
  settingsRepo: Pick<SettingsRepository, 'get'>;
}

/**
 * Settings keys customers are allowed to read. Everything else is refused
 * server-side — admin/feature-flag/system settings are never exposed.
 */
export const CUSTOMER_SAFE_SETTINGS = new Set([
  'app.default_language',
  'app.default_currency',
  'app.default_aspect_ratio',
  'content.default_voice',
]);

export function createBillingTools(deps: BillingToolDeps): AgentToolDefinition[] {
  return [
    {
      name: 'billing.balance',
      description: 'Get the current credit balance of the user\'s workspace.',
      paramsHint: '{}',
      paramsSchema: z.object({}),
      permission: 'customer',
      async execute(ctx) {
        return deps.billing.getBalance(ctx.userId);
      },
    },
  ];
}

export function createSettingsTools(deps: SettingsToolDeps): AgentToolDefinition[] {
  return [
    {
      name: 'settings.get',
      description:
        'Read a customer-safe workspace/app setting by key. Allowed keys: app.default_language, app.default_currency, app.default_aspect_ratio, content.default_voice.',
      paramsHint: '{ "key": string }',
      paramsSchema: z.object({ key: z.string().min(1).max(100) }),
      permission: 'customer',
      async execute(_ctx, args) {
        const key = (args as { key: string }).key;
        if (!CUSTOMER_SAFE_SETTINGS.has(key)) {
          return { allowed: false, key, value: null, message: 'This setting is not available.' };
        }
        return { allowed: true, key, value: (await deps.settingsRepo.get(key)) ?? null };
      },
    },
  ];
}
