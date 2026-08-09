import type { ProductUrlMetadata } from '@aura/types';

export interface IUrlMetadataExtractor {
  extract(url: string): Promise<ProductUrlMetadata>;
}
