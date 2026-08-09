import type { ProductAnalysis, ProductUrlMetadata } from '@aura/types';
import type { IAIProvider } from '../interfaces/ai-provider.interface.js';
import type { IUrlMetadataExtractor } from '../interfaces/url-extractor.interface.js';

export class ProductAnalysisService {
  constructor(
    private readonly ai: IAIProvider,
    private readonly urlExtractor: IUrlMetadataExtractor,
  ) {}

  async analyzeFromText(input: {
    language?: string;
        name: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProductAnalysis> {
    return this.ai.analyzeProduct({
            name: input.name,
      description: input.description,
      metadata: input.metadata,
    });
  }

  async analyzeFromUrl(url: string): Promise<{
    analysis: ProductAnalysis;
    metadata: ProductUrlMetadata;
  }> {
    const metadata = await this.urlExtractor.extract(url);
    const analysis = await this.ai.analyzeProduct({
      name: metadata.title ?? undefined,
      description: metadata.description ?? metadata.rawTextSnippet ?? undefined,
      url,
      imageUrl: metadata.images[0],
      extractedMeta: metadata,
    });
    return { analysis, metadata };
  }

  async analyzeFromImage(input: {
    imageUrl?: string;
    imageBase64?: string;
    mimeType?: string;
    name?: string;
    description?: string;
  }): Promise<ProductAnalysis> {
    return this.ai.analyzeProduct({
            name: input.name,
      description: input.description,
      imageUrl: input.imageUrl,
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
    });
  }
}
