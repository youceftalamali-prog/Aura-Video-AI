import { languageSystemInstruction } from '../../ai/utils/language-prompt.js';
import type { AdScript, GenerateScriptInput } from '@aura/types';
import type { IAIProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { adScriptSchema } from '../dto/schemas.js';
import { AppError } from '@aura/shared';

export class AdScriptService {
  constructor(private readonly ai: IAIProvider) {}

  async generate(input: GenerateScriptInput): Promise<AdScript> {
    const langDirective = languageSystemInstruction((input as { language?: string; contentLanguage?: string; videoLanguage?: string }).videoLanguage || (input as { contentLanguage?: string }).contentLanguage || (input as { language?: string }).language);
    const _languagePrefix = langDirective + "\n"; void _languagePrefix;
    const { productAnalysis: pa, creativeStrategy: cs } = input;

    const systemPrompt = _languagePrefix +  `You are an expert ad copywriter and video scriptwriter for product ads.
Return structured AdScript JSON only.`;

    const schemaDescription = `{
  "duration": number,
  "hook": string,
  "scenes": [{
    "order": number,
    "duration": number,
    "narration": string,
    "onScreenText": string,
    "visualDescription": string,
    "transition": string
  }],
  "narration": string (full combined),
  "onScreenText": string (summary),
  "visualDescription": string (overall),
  "transition": string
}`;

    const userPrompt = `Product: ${pa.productName}
Strategy objective: ${cs.objective}
Hook: ${cs.hook}
Key message: ${cs.keyMessage}
Tone: ${cs.tone}
CTA: ${cs.callToAction}
Duration: ${cs.suggestedDuration}s
Scenes plan: ${JSON.stringify(cs.scenes)}
Language: ${input.language ?? 'auto'}

Write a precise timed script aligned to the strategy scenes.`;

    try {
      return await this.ai.generateStructuredOutput<AdScript>({
        systemPrompt,
        userPrompt,
        schemaDescription,
        parse: (raw) => {
          const parsed = adScriptSchema.safeParse(raw);
          if (!parsed.success) {
            throw new AppError(
              'Ad script failed schema validation',
              502,
              'AI_SCHEMA_VALIDATION',
              { issues: parsed.error.flatten() },
            );
          }
          return parsed.data;
        },
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        `Ad script generation failed: ${(err as unknown as Error).message}`,
        502,
        'AI_PROVIDER_ERROR',
      );
    }
  }
}
