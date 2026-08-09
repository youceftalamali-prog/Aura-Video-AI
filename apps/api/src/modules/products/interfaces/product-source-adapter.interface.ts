import type { ExtractedProductData } from '@aura/types';

export interface IProductSourceAdapter {
  readonly name: string;
  canHandle(url: string): boolean;
  extract(url: string, html: string): Promise<ExtractedProductData>;
}
