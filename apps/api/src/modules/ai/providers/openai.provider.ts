import { languageSystemInstruction } from '../utils/language-prompt.js';
import { getEnv } from '@aura/config';
import { AppError, ValidationError } from '@aura/shared';
import type { ProductAnalysis } from '@aura/types';
import type {
  AnalyzeImageParams,
  AnalyzeProductParams,
  AnalyzeTextParams,
  GenerateStructuredParams,
  IAIProvider,
} from '../interfaces/ai-provider.interface.js';
import { productAnalysisSchema } from '../dto/schemas.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export class OpenAIProvider implements IAIProvider {
  readonly name = 'openai';

  private languageDirective(lang?: string): string {
    return languageSystemInstruction(lang);
  }

  private get apiKey(): string {
    const key = getEnv().AI_API_KEY;
    if (!key) {
      throw new AppError(
        'AI provider is not configured. Set AI_API_KEY in environment.',
        503,
        'AI_NOT_CONFIGURED',
      );
    }
    return key;
  }

  private get baseUrl(): string {
    return getEnv().AI_BASE_URL.replace(/\/$/, '');
  }

  private get model(): string {
    return getEnv().AI_MODEL;
  }

  private get visionModel(): string {
    return getEnv().AI_VISION_MODEL;
  }

  async analyzeText(params: AnalyzeTextParams): Promise<string> {
    const directive = this.languageDirective((params as { language?: string }).language);
    const messages: ChatMessage[] = [
      { role: 'system', content: directive + '\n' + params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ];
    return this.chatCompletion(messages, this.model, true);
  }

  async generateStructuredOutput<T>(params: GenerateStructuredParams<T>): Promise<T> {
    const system = `${params.systemPrompt}

You MUST respond with valid JSON only. No markdown, no code fences, no commentary.
Schema requirements:
${params.schemaDescription}`;

    const raw = await this.analyzeText({
      systemPrompt: system,
      userPrompt: params.userPrompt,
    });

    let parsed: unknown;
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new AppError('AI returned invalid JSON', 502, 'AI_INVALID_JSON');
    }

    return params.parse(parsed);
  }

  async analyzeProduct(params: AnalyzeProductParams): Promise<ProductAnalysis> {
    const directive = this.languageDirective((params as { language?: string }).language);
    const parts: string[] = [directive];
    if (params.name) parts.push(`Product name: ${params.name}`);
    if (params.description) parts.push(`Description: ${params.description}`);
    if (params.url) parts.push(`Product URL: ${params.url}`);
    if (params.extractedMeta) {
      parts.push(`Page title: ${params.extractedMeta.title ?? 'N/A'}`);
      parts.push(`Page description: ${params.extractedMeta.description ?? 'N/A'}`);
      parts.push(`Site: ${params.extractedMeta.siteName ?? 'N/A'}`);
      if (params.extractedMeta.rawTextSnippet) {
        parts.push(`Page text snippet: ${params.extractedMeta.rawTextSnippet.slice(0, 2000)}`);
      }
      if (params.extractedMeta.images.length) {
        parts.push(`Image URLs found: ${params.extractedMeta.images.slice(0, 5).join(', ')}`);
      }
    }
    if (params.metadata) {
      parts.push(`Extra metadata: ${JSON.stringify(params.metadata)}`);
    }

    const sourceType = params.url
      ? 'url'
      : params.imageUrl || params.imageBase64
        ? 'image'
        : 'text';

    const schemaDescription = `
{
  "productName": string,
  "shortDescription": string (max ~200 chars),
  "longDescription": string,
  "category": string,
  "targetAudience": string[],
  "keyBenefits": string[],
  "features": string[],
  "sellingPoints": string[],
  "keywords": string[],
  "brandTone": string,
  "visualStyle": string,
  "callToAction": string,
  "suggestedAdAngles": string[],
  "confidence": number between 0 and 1,
  "sourceType": "url" | "image" | "text",
  "sourceUrl": string | null,
  "imageUrl": string | null
}`;

    const systemPrompt = `You are an expert product marketing analyst. Always write all output fields in the language required by the user. for advertising video production.
Analyze the product information and produce a structured Product Brief for creating ad videos.
Be specific, practical, and marketing-oriented. Infer reasonable details when data is limited, but lower confidence accordingly.
Respond in the same language as the product description when possible.`;

    let result: ProductAnalysis;

    if (params.imageBase64 || params.imageUrl) {
      const visionText = await this.analyzeImage({
        imageUrl: params.imageUrl,
        imageBase64: params.imageBase64,
        mimeType: params.mimeType,
        systemPrompt,
        prompt: `Analyze this product image and the following context. Return ONLY JSON matching the schema.\n\nContext:\n${parts.join('\n')}\n\nsourceType must be "${sourceType}".`,
      });
      result = this.parseProductAnalysis(visionText, sourceType, params);
    } else {
      result = await this.generateStructuredOutput<ProductAnalysis>({
        systemPrompt,
        userPrompt: `${parts.join('\n')}\n\nsourceType must be "${sourceType}".`,
        schemaDescription,
        parse: (raw) => this.parseProductAnalysis(JSON.stringify(raw), sourceType, params),
      });
    }

    return result;
  }

  async analyzeImage(params: AnalyzeImageParams): Promise<string> {
    const imageContent = this.buildImageContent(params);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: params.systemPrompt ?? 'You are a product image analyst. Respond with clear structured analysis.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: params.prompt },
          imageContent,
        ],
      },
    ];
    return this.chatCompletion(messages, this.visionModel, true);
  }

  private buildImageContent(params: AnalyzeImageParams): {
    type: string;
    image_url: { url: string };
  } {
    if (params.imageUrl) {
      return { type: 'image_url', image_url: { url: params.imageUrl } };
    }
    if (params.imageBase64) {
      const mime = params.mimeType || 'image/jpeg';
      const dataUrl = params.imageBase64.startsWith('data:')
        ? params.imageBase64
        : `data:${mime};base64,${params.imageBase64}`;
      return { type: 'image_url', image_url: { url: dataUrl } };
    }
    throw new ValidationError('imageUrl or imageBase64 is required');
  }

  private parseProductAnalysis(
    raw: string,
    sourceType: 'url' | 'image' | 'text',
    params: AnalyzeProductParams,
  ): ProductAnalysis {
    let parsed: unknown;
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = typeof cleaned === 'string' && cleaned.startsWith('{') ? JSON.parse(cleaned) : JSON.parse(raw);
    } catch {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AppError('AI returned invalid product analysis JSON', 502, 'AI_INVALID_JSON');
      }
    }

    const withDefaults = {
      ...(parsed as object),
      sourceType,
      sourceUrl: (parsed as unknown as ProductAnalysis).sourceUrl ?? params.url ?? null,
      imageUrl:
        (parsed as unknown as ProductAnalysis).imageUrl ??
        params.imageUrl ??
        params.extractedMeta?.images?.[0] ??
        null,
    };

    const result = productAnalysisSchema.safeParse(withDefaults);
    if (!result.success) {
      throw new AppError(
        'AI product analysis failed schema validation',
        502,
        'AI_SCHEMA_VALIDATION',
        { issues: result.error.flatten() },
      );
    }
    return result.data;
  }

  private async chatCompletion(
    messages: ChatMessage[],
    model: string,
    jsonMode: boolean,
  ): Promise<string> {
    const env = getEnv();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        temperature: env.AI_TEMPERATURE,
        max_tokens: env.AI_MAX_TOKENS,
      };
      if (jsonMode) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new AppError(
          `AI provider error: ${response.status}`,
          502,
          'AI_PROVIDER_ERROR',
          { status: response.status, body: errText.slice(0, 500) },
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError('AI provider returned empty response', 502, 'AI_EMPTY_RESPONSE');
      }
      return content;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as unknown as Error).name === 'AbortError') {
        throw new AppError('AI request timed out', 504, 'AI_TIMEOUT');
      }
      throw new AppError(
        `AI request failed: ${(err as unknown as Error).message}`,
        502,
        'AI_REQUEST_FAILED',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
