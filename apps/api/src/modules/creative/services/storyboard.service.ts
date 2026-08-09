import { languageSystemInstruction } from '../../ai/utils/language-prompt.js';
import type { GenerateStoryboardInput, Storyboard, StoryboardScene } from '@aura/types';
import type { IAIProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { storyboardSchema } from '../dto/schemas.js';
import { AppError } from '@aura/shared';
import { generateRandomString } from '@aura/shared';

export class StoryboardService {
  constructor(private readonly ai: IAIProvider) {}

  async generate(input: GenerateStoryboardInput): Promise<Storyboard> {
    const langDirective = languageSystemInstruction((input as { language?: string; contentLanguage?: string; videoLanguage?: string }).videoLanguage || (input as { contentLanguage?: string }).contentLanguage || (input as { language?: string }).language);
    const _languagePrefix = langDirective + "\n"; void _languagePrefix;
    const { adScript, creativeStrategy } = input;
    const aspectRatio = input.aspectRatio ?? creativeStrategy.suggestedAspectRatio;

    const systemPrompt = _languagePrefix +  `You are a commercial video storyboard artist.
Convert an ad script into production-ready storyboard scenes with visual prompts suitable for image/video AI models.
Return Storyboard JSON only.`;

    const schemaDescription = `{
  "duration": number,
  "aspectRatio": "16:9"|"9:16"|"1:1"|"4:5",
  "scenes": [{
    "sceneId": string,
    "order": number,
    "duration": number,
    "visualPrompt": string (detailed image/video generation prompt),
    "cameraDirection": string,
    "subject": string,
    "background": string,
    "lighting": string,
    "textOverlay": string,
    "audioDirection": string
  }]
}`;

    const userPrompt = `Aspect ratio: ${aspectRatio}
Visual direction: ${creativeStrategy.visualDirection}
Tone: ${creativeStrategy.tone}
Script duration: ${adScript.duration}
Script scenes: ${JSON.stringify(adScript.scenes)}
Overall visual: ${adScript.visualDescription}

Each scene needs a self-contained visualPrompt for media generation.`;

    try {
      const result = await this.ai.generateStructuredOutput<Storyboard>({
        systemPrompt,
        userPrompt,
        schemaDescription,
        parse: (raw) => {
          const data = raw as unknown as Storyboard;
          if (Array.isArray(data.scenes)) {
            data.scenes = data.scenes.map((s: StoryboardScene, i: number) => ({
              ...s,
              sceneId: s.sceneId || `scene_${i + 1}_${generateRandomString(6)}`,
              order: s.order ?? i + 1,
            }));
          }
          const parsed = storyboardSchema.safeParse(data);
          if (!parsed.success) {
            throw new AppError(
              'Storyboard failed schema validation',
              502,
              'AI_SCHEMA_VALIDATION',
              { issues: parsed.error.flatten() },
            );
          }
          return parsed.data;
        },
      });
      return result;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Storyboard generation failed: ${(err as unknown as Error).message}`,
        502,
        'AI_PROVIDER_ERROR',
      );
    }
  }
}
