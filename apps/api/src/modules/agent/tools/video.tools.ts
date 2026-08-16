import { z } from 'zod';
import type { LibraryService } from '../../library/services/library.service.js';
import type { ProductService } from '../../products/services/product.service.js';
import type { VideoGenerationService } from '../../video/services/video-generation.service.js';
import type { AgentContext } from '../types.js';
import { deterministicHash } from '../services/tool-call-hash.js';
import type { AgentToolDefinition } from './agent-tool.js';

export interface VideoToolDeps {
  video: Pick<VideoGenerationService, 'estimateCost' | 'createJob' | 'getJob' | 'cancelJob'>;
  products: Pick<ProductService, 'createVideoWorkflow'>;
  library: Pick<LibraryService, 'createProject'>;
}

export interface PreparedVideoWorkflow {
  productId: string;
  productName: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  duration: number;
  scenes: Array<{
    order: number;
    duration: number;
    visualPrompt: string;
    narration?: string;
    onScreenText?: string;
    cameraDirection?: string;
  }>;
  templateRecommendations: Array<{
    templateId: string;
    name?: string;
    creditsCost?: number;
    fit?: string;
  }>;
  creativeAngle: string;
  callToAction: string;
  tone: string;
  selectedHook: string | null;
}

const videoCreateParams = z.object({
  productId: z.string().uuid(),
  angleType: z
    .enum(['problem_solution', 'product_demo', 'benefits', 'lifestyle', 'social_proof', 'urgency', 'offer', 'comparison'])
    .optional(),
  hookText: z.string().max(500).optional(),
  templateId: z.string().uuid().optional(),
  duration: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional(),
  platform: z.string().max(40).optional(),
  tone: z.string().max(40).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:5']).optional(),
});

export function createVideoTools(deps: VideoToolDeps): AgentToolDefinition[] {
  return [
    {
      name: 'video.create',
      description:
        'Create a video ad for a saved product: generates strategy, script, storyboard, recommends templates, creates a project and starts a video generation job. Spends credits.',
      paramsHint:
        '{ "productId": "uuid", "angleType"?: "problem_solution"|"product_demo"|"benefits"|"lifestyle"|"social_proof"|"urgency"|"offer"|"comparison", "hookText"?: string, "templateId"?: "uuid", "duration"?: 15|30|45|60, "platform"?: string, "tone"?: string, "aspectRatio"?: "16:9"|"9:16"|"1:1"|"4:5" }',
      paramsSchema: videoCreateParams,
      permission: 'customer',
      confirmation: {
        reason: 'Creating a video spends credits and starts a background generation job.',
      },
      async prepare(ctx, args) {
        const input = args as z.infer<typeof videoCreateParams>;
        const workflow = await deps.products.createVideoWorkflow(ctx.userId, input);
        const prepared: PreparedVideoWorkflow = {
          productId: workflow.productId,
          productName: workflow.analysis.productName,
          aspectRatio: workflow.storyboard.aspectRatio,
          duration: workflow.storyboard.duration,
          scenes: workflow.storyboard.scenes.map((scene) => {
            const scriptScene = workflow.script.scenes.find((s) => s.order === scene.order);
            return {
              order: scene.order,
              duration: scene.duration,
              visualPrompt: scene.visualPrompt,
              narration: scriptScene?.narration || undefined,
              onScreenText: scene.textOverlay || undefined,
              cameraDirection: scene.cameraDirection || undefined,
            };
          }),
          templateRecommendations: workflow.templateRecommendations.map((rec) => ({
            templateId: rec.templateId,
            name: rec.name,
            creditsCost: rec.creditsCost,
            fit: rec.fit,
          })),
          creativeAngle: workflow.strategy.creativeAngle,
          callToAction: workflow.strategy.callToAction,
          tone: workflow.strategy.tone,
          selectedHook: workflow.selectedHook,
        };
        return prepared;
      },
      async estimate(_ctx, _args, prepared) {
        const p = prepared as PreparedVideoWorkflow;
        const estimate = await deps.video.estimateCost({
          duration: p.duration,
          scenes: p.scenes,
          mode: 'storyboard',
        });
        return { credits: estimate.credits, breakdown: estimate.breakdown };
      },
      async execute(ctx, args, prepared) {
        const input = args as z.infer<typeof videoCreateParams>;
        const workflow =
          (prepared as PreparedVideoWorkflow | undefined) ??
          (await (this as { prepare(ctx: AgentContext, a: Record<string, unknown>): Promise<PreparedVideoWorkflow> }).prepare(ctx, args));

        const templateId = input.templateId ?? workflow.templateRecommendations[0]?.templateId;
        const project = await deps.library.createProject(ctx.userId, {
          name: `${workflow.productName.slice(0, 180)} — video`,
          templateId,
          productId: workflow.productId,
        });

        const idempotencyKey = `agent:${ctx.conversationId}:${deterministicHash(args)}`;
        const job = await deps.video.createJob(ctx.userId, {
          projectId: project.id,
          templateId,
          aspectRatio: workflow.aspectRatio,
          duration: workflow.duration,
          scenes: workflow.scenes,
          mode: 'storyboard',
          idempotencyKey,
        });

        return {
          jobId: job.jobId,
          status: job.status,
          creditsCharged: job.creditsCharged,
          projectId: project.id,
          templateId,
          creativeAngle: workflow.creativeAngle,
          callToAction: workflow.callToAction,
          selectedHook: workflow.selectedHook,
          templateRecommendations: workflow.templateRecommendations,
        };
      },
    },
    {
      name: 'video.status',
      description: 'Get the status of a video generation job.',
      paramsHint: '{ "jobId": "uuid" }',
      paramsSchema: z.object({ jobId: z.string().uuid() }),
      permission: 'customer',
      async execute(ctx, args) {
        return deps.video.getJob(ctx.userId, (args as { jobId: string }).jobId);
      },
    },
    {
      name: 'video.cancel',
      description: 'Cancel a video generation job (only while it is still running).',
      paramsHint: '{ "jobId": "uuid" }',
      paramsSchema: z.object({ jobId: z.string().uuid() }),
      permission: 'customer',
      async execute(ctx, args) {
        return deps.video.cancelJob(ctx.userId, (args as { jobId: string }).jobId);
      },
    },
  ];
}
