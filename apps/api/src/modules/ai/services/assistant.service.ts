import { languageSystemInstruction } from '../utils/language-prompt.js';
import type {
  AIAssistantInput,
  AIAssistantResponse,
  AIIntent,
  ProductAnalysis,
} from '@aura/types';
import type { IAIProvider } from '../interfaces/ai-provider.interface.js';
import { aiIntentSchema } from '../dto/schemas.js';
import { AppError } from '@aura/shared';

export class AIAssistantService {
  constructor(private readonly ai: IAIProvider) {}

  async process(input: AIAssistantInput): Promise<AIAssistantResponse> {
    const intent = await this.detectIntent(input);
    const product = input.productAnalysis ?? null;

    const recommendedNextStep = this.resolveNextStep(intent, product);
    const message = this.buildMessage(intent, product, recommendedNextStep);

    return {
      intent,
      product,
      recommendedNextStep,
      message,
    };
  }

  private async detectIntent(input: AIAssistantInput): Promise<AIIntent> {
    const productContext = input.productAnalysis
      ? `Product: ${input.productAnalysis.productName} — ${input.productAnalysis.shortDescription}`
      : 'No product analysis attached.';

    const schemaDescription = `
{
  "intent": one of ANALYZE_PRODUCT | CREATE_PRODUCT_AD | CREATE_VIDEO | CREATE_IMAGE | SELECT_TEMPLATE | EDIT_AD | EXPORT_VIDEO | UNKNOWN,
  "productId": uuid string or null,
  "requestedFormat": "video" | "image" | "ad" | "analysis" | null,
  "style": string or null,
  "duration": number or null,
  "language": string or null,
  "nextAction": string or null,
  "confidence": 0-1,
  "summary": short string summarizing user request
}`;

    const langInstruction = languageSystemInstruction((arguments[0] as { language?: string })?.language);
    const systemPrompt = `${langInstruction}
You are an AI assistant for an advertising video platform (Aura Video AI).
Detect the user's intent from their message. Focus on ad/video creation workflows.
Do NOT claim that a video was generated — only detect intent and recommend next steps.
Respond with JSON only.`;

    const userPrompt = `User message: "${input.message}"
Language preference: ${input.language ?? 'auto'}
Product ID: ${input.productId ?? 'null'}
${productContext}`;

    try {
      return await this.ai.generateStructuredOutput<AIIntent>({
        systemPrompt,
        userPrompt,
        schemaDescription,
        parse: (raw) => {
          const parsed = aiIntentSchema.safeParse({
            ...(raw as object),
            productId: (raw as unknown as AIIntent).productId ?? input.productId ?? null,
          });
          if (!parsed.success) {
            throw new AppError('Invalid intent structure from AI', 502, 'AI_INTENT_INVALID');
          }
          return parsed.data;
        },
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Fallback heuristic without claiming success of generation
      return this.heuristicIntent(input);
    }
  }

  private heuristicIntent(input: AIAssistantInput): AIIntent {
    const msg = input.message.toLowerCase();
    let intent: AIIntent['intent'] = 'UNKNOWN';
    let requestedFormat: AIIntent['requestedFormat'] = null;
    let nextAction = 'CLARIFY_REQUEST';

    if (/analy[sz]e|تحليل|حلل/.test(msg)) {
      intent = 'ANALYZE_PRODUCT';
      requestedFormat = 'analysis';
      nextAction = 'SHOW_PRODUCT_ANALYSIS';
    } else if (/video|فيديو|reel|اد|إعلان|advert/.test(msg)) {
      intent = 'CREATE_PRODUCT_AD';
      requestedFormat = 'video';
      nextAction = input.productAnalysis ? 'SELECT_TEMPLATE' : 'ANALYZE_PRODUCT_FIRST';
    } else if (/image|صورة|صورة إعلان/.test(msg)) {
      intent = 'CREATE_IMAGE';
      requestedFormat = 'image';
      nextAction = input.productAnalysis ? 'SELECT_TEMPLATE' : 'ANALYZE_PRODUCT_FIRST';
    } else if (/template|قالب/.test(msg)) {
      intent = 'SELECT_TEMPLATE';
      nextAction = 'SELECT_TEMPLATE';
    }

    return {
      intent,
      productId: input.productId ?? null,
      requestedFormat,
      style: null,
      duration: null,
      language: input.language ?? null,
      nextAction,
      confidence: 0.55,
      summary: input.message.slice(0, 200),
    };
  }

  private resolveNextStep(intent: AIIntent, product: ProductAnalysis | null): string {
    if (!product && intent.intent !== 'ANALYZE_PRODUCT') {
      return 'Analyze a product first (URL, image, or text description).';
    }
    switch (intent.intent) {
      case 'ANALYZE_PRODUCT':
        return 'Review the product analysis, then request an ad or video.';
      case 'CREATE_PRODUCT_AD':
      case 'CREATE_VIDEO':
        return 'Select a professional template to continue (video generation is available in a later phase).';
      case 'CREATE_IMAGE':
        return 'Select an image ad template (image generation is available in a later phase).';
      case 'SELECT_TEMPLATE':
        return 'Browse available templates for this product.';
      case 'EDIT_AD':
        return 'Open the ad editor once a draft exists.';
      case 'EXPORT_VIDEO':
        return 'Export will be available after video generation.';
      default:
        return intent.nextAction ?? 'Clarify what you want to create.';
    }
  }

  private buildMessage(
    intent: AIIntent,
    product: ProductAnalysis | null,
    nextStep: string,
  ): string {
    const productLabel = product ? `"${product.productName}"` : 'your product';
    return `Detected intent: ${intent.intent}. For ${productLabel}: ${nextStep}`;
  }
}
