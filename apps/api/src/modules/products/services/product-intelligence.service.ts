import type {
  ProductAnalysis,
  ProductIntelligence,
  ExtractedProductData,
  GeneratedHook,
  RoutingStrategy,
} from '@aura/types';
import type { IAIProvider } from '../../ai/interfaces/ai-provider.interface.js';
import { AppError } from '@aura/shared';
import { z } from 'zod';

const intelligenceSchema = z.object({
  productProfile: z.object({
    category: z.string(),
    brand: z.string().nullable(),
    features: z.array(z.string()),
    specifications: z.array(z.string()),
    facts: z.array(z.string()),
  }),
  marketingProfile: z.object({
    primaryBenefit: z.string(),
    secondaryBenefits: z.array(z.string()),
    painPoints: z.array(z.string()),
    objections: z.array(z.string()),
    differentiators: z.array(z.string()),
  }),
  audienceProfile: z.object({
    demographics: z.array(z.string()),
    interests: z.array(z.string()),
    useCases: z.array(z.string()),
    buyingMotivations: z.array(z.string()),
  }),
  sellingPoints: z.array(z.string()),
  marketingAngles: z.array(
    z.object({
      type: z.enum([
        'problem_solution',
        'product_demo',
        'benefits',
        'lifestyle',
        'social_proof',
        'urgency',
        'offer',
        'comparison',
      ]),
      title: z.string(),
      description: z.string(),
      recommended: z.boolean(),
    }),
  ),
  contentRecommendations: z.object({
    hooks: z.array(z.string()),
    ctaSuggestions: z.array(z.string()),
    visualStyle: z.string(),
    tone: z.string(),
  }),
  confidence: z.number().min(0).max(1),
});

const hooksSchema = z.array(
  z.object({
    style: z.enum([
      'curiosity',
      'problem_solution',
      'benefit',
      'emotional',
      'direct_response',
      'ugc',
      'demonstration',
      'short_form_social',
    ]),
    text: z.string(),
    score: z.number(),
  }),
);

export class ProductIntelligenceService {
  constructor(private readonly ai: IAIProvider) {}

  async build(
    analysis: ProductAnalysis,
    extracted?: ExtractedProductData | null,
    strategy?: RoutingStrategy,
  ): Promise<ProductIntelligence> {
    const systemPrompt = `You are a product marketing analyst.
Separate verified facts from inferred marketing suggestions.
Never invent product claims that are not supported by the input.
Return structured JSON only.`;

    const schemaDescription = `{
  productProfile: { category, brand, features[], specifications[], facts[] },
  marketingProfile: { primaryBenefit, secondaryBenefits[], painPoints[], objections[], differentiators[] },
  audienceProfile: { demographics[], interests[], useCases[], buyingMotivations[] },
  sellingPoints: string[],
  marketingAngles: [{ type, title, description, recommended }],
  contentRecommendations: { hooks[], ctaSuggestions[], visualStyle, tone },
  confidence: number 0-1
}`;

    const userPrompt = `Product analysis:
${JSON.stringify(analysis, null, 2)}

Extracted facts (treat as primary source of truth when present):
${JSON.stringify(extracted?.rawFacts ?? {}, null, 2)}

Build ProductIntelligence. Label only supported facts in productProfile.facts.`;

    try {
      const partial = await this.ai.generateStructuredOutput<z.infer<typeof intelligenceSchema>>(
        {
          systemPrompt,
          userPrompt,
          schemaDescription,
          parse: (raw) => {
            const parsed = intelligenceSchema.safeParse(raw);
            if (!parsed.success) {
              throw new AppError('Intelligence schema validation failed', 502, 'AI_SCHEMA_VALIDATION', {
                issues: parsed.error.flatten(),
              });
            }
            return parsed.data;
          },
        },
        { strategy },
      );

      return {
        ...partial,
        analysis,
        extracted: extracted ?? null,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Product intelligence failed: ${(err as unknown as Error).message}`, 502, 'AI_PROVIDER_ERROR');
    }
  }

  async generateHooks(
    analysis: ProductAnalysis,
    intelligence: ProductIntelligence,
    strategy?: RoutingStrategy,
  ): Promise<GeneratedHook[]> {
    const systemPrompt = `Generate short advertising hooks for product ads.
No deceptive medical/financial claims. JSON array only.`;
    const schemaDescription = `[{ style, text, score }]`;
    const userPrompt = `Product: ${analysis.productName}
Benefits: ${intelligence.marketingProfile.primaryBenefit}
Angles: ${intelligence.marketingAngles.map((a) => a.type).join(', ')}
Generate 8 diverse hooks.`;

    try {
      return await this.ai.generateStructuredOutput<GeneratedHook[]>(
        {
          systemPrompt,
          userPrompt,
          schemaDescription,
          parse: (raw) => {
            const parsed = hooksSchema.safeParse(raw);
            if (!parsed.success) {
              throw new AppError('Hooks schema validation failed', 502, 'AI_SCHEMA_VALIDATION');
            }
            return parsed.data;
          },
        },
        { strategy },
      );
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Hook generation failed: ${(err as unknown as Error).message}`, 502, 'AI_PROVIDER_ERROR');
    }
  }
}
