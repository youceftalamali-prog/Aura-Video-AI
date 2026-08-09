import type { IProductSourceAdapter } from '../interfaces/product-source-adapter.interface.js';
import { GenericHTMLProductAdapter } from './generic-html.adapter.js';

const adapters: IProductSourceAdapter[] = [new GenericHTMLProductAdapter()];

export function resolveProductAdapter(url: string): IProductSourceAdapter {
  return adapters.find((a) => a.canHandle(url) && a.name !== 'generic_html') || adapters[adapters.length - 1]!;
}

export { GenericHTMLProductAdapter };
