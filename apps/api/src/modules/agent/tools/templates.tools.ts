import { z } from 'zod';
import type { TemplateService } from '../../creative/services/template.service.js';
import type { AgentToolDefinition } from './agent-tool.js';

export interface TemplateToolDeps {
  templates: Pick<TemplateService, 'listActive' | 'getByIdOrThrow'>;
}

export function createTemplateTools(deps: TemplateToolDeps): AgentToolDefinition[] {
  return [
    {
      name: 'template.list',
      description: 'List the available published video templates.',
      paramsHint: '{ "limit"?: number }',
      paramsSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      permission: 'customer',
      async execute(_ctx, args) {
        const { limit } = args as { limit?: number };
        const rows = await deps.templates.listActive();
        return limit ? rows.slice(0, limit) : rows;
      },
    },
    {
      name: 'template.get',
      description: 'Get a video template by id.',
      paramsHint: '{ "templateId": "uuid" }',
      paramsSchema: z.object({ templateId: z.string().uuid() }),
      permission: 'customer',
      async execute(_ctx, args) {
        return deps.templates.getByIdOrThrow((args as { templateId: string }).templateId);
      },
    },
  ];
}
