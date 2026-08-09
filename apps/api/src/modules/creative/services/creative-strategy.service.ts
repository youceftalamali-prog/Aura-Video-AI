import { languageSystemInstruction } from '../../ai/utils/language-prompt.js';
import type { CreativeStrategy, GenerateStrategyInput } from '@aura/types';
import type { IAIProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { creativeStrategySchema } from '../dto/schemas.js';
import { AppError } from '@aura/shared';

export class CreativeStrategyService {
  constructor(private readonly ai: IAIProvider) {}

  async generate(input: GenerateStrategyInput): Promise<CreativeStrategy> {
    const langDirective = languageSystemInstruction((input as { language?: string; contentLanguage?: string }).contentLanguage || (input as { language?: string }).language);
    const _languagePrefix = langDirective + "\n"; void _languagePrefix;
    const pa = input.productAnalysis;
    const duration = input.preferredDuration ?? 15;
    const aspect = input.preferredAspectRatio ?? '9:16';

    const systemPrompt = _languagePrefix +  `You are a senior advertising creative strategist for short-form product videos.
Produce a structured CreativeStrategy JSON only. No markdown.`;

    const schemaDescription = `{
  "objective": string,
  "targetAudience": string[],
  "creativeAngle": string,
  "hook": string,
  "keyMessage": string,
  "tone": string,
  "visualDirection": string,
  "callToAction": string,
  "suggestedDuration": number (seconds),
  "suggestedAspectRatio": "16:9"|"9:16"|"1:1"|"4:5",
  "scenes": [{ "order": number, "purpose": string, "description": string, "durationSeconds": number }]
}`;

    const userPrompt = `Product: ${pa.productName}
Category: ${pa.category}
Short: ${pa.shortDescription}
Benefits: ${pa.keyBenefits.join('; ')}
Selling points: ${pa.sellingPoints.join('; ')}
Brand tone: ${pa.brandTone}
Visual style: ${pa.visualStyle}
CTA: ${pa.callToAction}
Angles: ${pa.suggestedAdAngles.join('; ')}
User request: ${input.userRequest ?? 'Create a high-converting product ad'}
Language: ${input.language ?? 'auto'}
Preferred duration: ${duration}s
Preferred aspect ratio: ${aspect}

Design a coherent multi-scene strategy. Sum of scene durations should approximate suggestedDuration.`;

    try {
      return await this.ai.generateStructuredOutput<CreativeStrategy>({
        systemPrompt,
        userPrompt,
        schemaDescription,
        parse: (raw) => {
          const parsed = creativeStrategySchema.safeParse(raw);
          if (!parsed.success) {
            throw new AppError(
              'Creative strategy failed schema validation',
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
        `Creative strategy generation failed: ${(err as unknown as Error).message}`,
        502,
        'AI_PROVIDER_ERROR',
      );
    }
  }
}
