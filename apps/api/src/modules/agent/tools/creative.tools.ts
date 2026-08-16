import { z } from 'zod';
import { productAnalysisSchema } from '../../ai/dto/schemas.js';
import type { AdScriptService } from '../../creative/services/ad-script.service.js';
import type { CreativeStrategyService } from '../../creative/services/creative-strategy.service.js';
import type { StoryboardService } from '../../creative/services/storyboard.service.js';
import type { TemplateService } from '../../creative/services/template.service.js';
import type { AgentToolDefinition } from './agent-tool.js';

export interface CreativeToolDeps {
  strategy: Pick<CreativeStrategyService, 'generate'>;
  script: Pick<AdScriptService, 'generate'>;
  storyboard: Pick<StoryboardService, 'generate'>;
  templates: Pick<TemplateService, 'listActive' | 'getByIdOrThrow' | 'recommend'>;
}

export const creativeStrategySchema = z.object({
  objective: z.string().min(1).max(500),
  targetAudience: z.array(z.string()).min(1).max(20),
  creativeAngle: z.string().min(1).max(500),
  hook: z.string().min(1).max(500),
  keyMessage: z.string().min(1).max(500),
  tone: z.string().min(1).max(120),
  visualDirection: z.string().min(1).max(1000),
  callToAction: z.string().min(1).max(200),
  suggestedDuration: z.number().positive().max(120),
  suggestedAspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']),
  scenes: z
    .array(
      z.object({
        order: z.number().int().min(1),
        purpose: z.string().min(1).max(200),
        description: z.string().min(1).max(1000),
        durationSeconds: z.number().positive().max(60),
      }),
    )
    .min(1)
    .max(20),
});

export const adScriptSchema = z.object({
  duration: z.number().positive().max(120),
  hook: z.string().min(1).max(500),
  scenes: z
    .array(
      z.object({
        order: z.number().int().min(1),
        duration: z.number().positive().max(60),
        narration: z.string().max(1000),
        onScreenText: z.string().max(300),
        visualDescription: z.string().min(1).max(1000),
        transition: z.string().max(100),
      }),
    )
    .min(1)
    .max(20),
  narration: z.string().max(5000),
  onScreenText: z.string().max(1000),
  visualDescription: z.string().max(5000),
  transition: z.string().max(200),
});

export const storyboardSchema = z.object({
  duration: z.number().positive().max(120),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']),
  scenes: z
    .array(
      z.object({
        sceneId: z.string().min(1).max(64),
        order: z.number().int().min(1),
        duration: z.number().positive().max(60),
        visualPrompt: z.string().min(1).max(2000),
        cameraDirection: z.string().max(300),
        subject: z.string().max(300),
        background: z.string().max(500),
        lighting: z.string().max(200),
        textOverlay: z.string().max(300),
        audioDirection: z.string().max(300),
      }),
    )
    .min(1)
    .max(20),
});

export function createCreativeTools(deps: CreativeToolDeps): AgentToolDefinition[] {
  return [
    {
      name: 'creative.strategy',
      description: 'Generate a creative advertising strategy from a product analysis.',
      paramsHint:
        '{ "productAnalysis": <productAnalysis>, "userRequest"?: string, "language"?: string, "preferredDuration"?: number, "preferredAspectRatio"?: "16:9"|"9:16"|"1:1"|"4:5" }',
      paramsSchema: z.object({
        productAnalysis: productAnalysisSchema,
        userRequest: z.string().max(2000).optional(),
        language: z.string().max(20).optional(),
        preferredDuration: z.number().positive().max(120).optional(),
        preferredAspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
      }),
      permission: 'customer',
      async execute(_ctx, args) {
        const { productAnalysis, userRequest, language, preferredDuration, preferredAspectRatio } = args as {
          productAnalysis: Record<string, unknown>;
          userRequest?: string;
          language?: string;
          preferredDuration?: number;
          preferredAspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
        };
        return deps.strategy.generate({
          productAnalysis: productAnalysis as never,
          userRequest,
          language,
          preferredDuration,
          preferredAspectRatio,
        });
      },
    },
    {
      name: 'creative.script',
      description: 'Generate an ad script from a product analysis and a creative strategy.',
      paramsHint:
        '{ "productAnalysis": <productAnalysis>, "creativeStrategy": <creativeStrategy>, "language"?: string }',
      paramsSchema: z.object({
        productAnalysis: productAnalysisSchema,
        creativeStrategy: creativeStrategySchema,
        language: z.string().max(20).optional(),
      }),
      permission: 'customer',
      async execute(_ctx, args) {
        const { productAnalysis, creativeStrategy, language } = args as {
          productAnalysis: Record<string, unknown>;
          creativeStrategy: Record<string, unknown>;
          language?: string;
        };
        return deps.script.generate({
          productAnalysis: productAnalysis as never,
          creativeStrategy: creativeStrategy as never,
          language,
        });
      },
    },
    {
      name: 'creative.storyboard',
      description: 'Generate a visual storyboard from an ad script and a creative strategy.',
      paramsHint:
        '{ "adScript": <adScript>, "creativeStrategy": <creativeStrategy>, "aspectRatio"?: "16:9"|"9:16"|"1:1"|"4:5" }',
      paramsSchema: z.object({
        adScript: adScriptSchema,
        creativeStrategy: creativeStrategySchema,
        aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
      }),
      permission: 'customer',
      async execute(_ctx, args) {
        const { adScript, creativeStrategy, aspectRatio } = args as {
          adScript: Record<string, unknown>;
          creativeStrategy: Record<string, unknown>;
          aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
        };
        return deps.storyboard.generate({
          adScript: adScript as never,
          creativeStrategy: creativeStrategy as never,
          aspectRatio,
        });
      },
    },
    {
      name: 'creative.recommendTemplate',
      description: 'Recommend the best templates for a product analysis and creative strategy.',
      paramsHint:
        '{ "productAnalysis": <productAnalysis>, "creativeStrategy": <creativeStrategy>, "limit"?: number }',
      paramsSchema: z.object({
        productAnalysis: productAnalysisSchema,
        creativeStrategy: creativeStrategySchema,
        limit: z.number().int().min(1).max(20).optional(),
      }),
      permission: 'customer',
      async execute(_ctx, args) {
        const { productAnalysis, creativeStrategy, limit } = args as {
          productAnalysis: Record<string, unknown>;
          creativeStrategy: Record<string, unknown>;
          limit?: number;
        };
        const all = await deps.templates.listActive();
        return deps.templates.recommend(productAnalysis as never, creativeStrategy as never, all, limit ?? 5);
      },
    },
  ];
}
