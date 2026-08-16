import { z } from 'zod';
import type { ProductAnalysisService } from '../../ai/services/product-analysis.service.js';
import type { ProductService } from '../../products/services/product.service.js';
import type { AgentToolDefinition } from './agent-tool.js';

export interface ProductToolDeps {
  products: Pick<
    ProductService,
    'list' | 'get' | 'importUrl' | 'importText' | 'importImage' | 'getIntelligence' | 'generateHooks'
  >;
  analysis: Pick<ProductAnalysisService, 'analyzeFromText' | 'analyzeFromUrl'>;
}

const productIdParam = z.object({ productId: z.string().uuid() });
const listParam = z.object({ limit: z.number().int().min(1).max(100).optional() });

export function createProductTools(deps: ProductToolDeps): AgentToolDefinition[] {
  return [
    {
      name: 'product.list',
      description: 'List the user\'s saved products.',
      paramsHint: '{ "limit": number }',
      paramsSchema: listParam,
      permission: 'customer',
      async execute(ctx, args) {
        const { limit } = args as { limit?: number };
        const rows = await deps.products.list(ctx.userId);
        return limit ? rows.slice(0, limit) : rows;
      },
    },
    {
      name: 'product.get',
      description: 'Get a saved product by id.',
      paramsHint: '{ "productId": "uuid" }',
      paramsSchema: productIdParam,
      permission: 'customer',
      async execute(ctx, args) {
        return deps.products.get(ctx.userId, (args as { productId: string }).productId);
      },
    },
    {
      name: 'product.import.url',
      description: 'Import a product from a public URL (title, description, price, images). May use credits.',
      paramsHint: '{ "url": "https://..." }',
      paramsSchema: z.object({ url: z.string().url().max(2048) }),
      permission: 'customer',
      confirmation: { reason: 'Importing a product creates a new saved product and may use credits.' },
      async execute(ctx, args) {
        return deps.products.importUrl(ctx.userId, ctx.workspaceId, (args as { url: string }).url);
      },
    },
    {
      name: 'product.import.text',
      description: 'Import a product from a text description. May use credits.',
      paramsHint: '{ "name": string, "description": string, "price"?: string, "currency"?: string, "brand"?: string }',
      paramsSchema: z.object({
        name: z.string().min(1).max(200),
        description: z.string().min(1).max(10_000),
        price: z.string().max(40).optional(),
        currency: z.string().max(3).optional(),
        brand: z.string().max(100).optional(),
      }),
      permission: 'customer',
      confirmation: { reason: 'Importing a product creates a new saved product and may use credits.' },
      async execute(ctx, args) {
        const { name, description, price, currency, brand } = args as {
          name: string;
          description: string;
          price?: string;
          currency?: string;
          brand?: string;
        };
        return deps.products.importText(ctx.userId, ctx.workspaceId, { name, description, price, currency, brand });
      },
    },
    {
      name: 'product.import.image',
      description: 'Import a product from an image (URL or base64). May use credits.',
      paramsHint: '{ "imageUrl"?: "https://...", "imageBase64"?: string, "mimeType"?: string, "name"?: string, "description"?: string }',
      paramsSchema: z
        .object({
          imageUrl: z.string().url().max(2048).optional(),
          imageBase64: z.string().max(8_000_000).optional(),
          mimeType: z.string().max(100).optional(),
          name: z.string().max(200).optional(),
          description: z.string().max(5000).optional(),
        })
        .refine((d) => d.imageUrl || d.imageBase64, { message: 'imageUrl or imageBase64 required' }),
      permission: 'customer',
      confirmation: { reason: 'Importing a product creates a new saved product and may use credits.' },
      async execute(ctx, args) {
        const { imageUrl, imageBase64, mimeType, name, description } = args as {
          imageUrl?: string;
          imageBase64?: string;
          mimeType?: string;
          name?: string;
          description?: string;
        };
        return deps.products.importImage(ctx.userId, ctx.workspaceId, {
          imageUrl,
          imageBase64,
          mimeType,
          name,
          description,
        });
      },
    },
    {
      name: 'product.analyze',
      description: 'Analyze a product from a URL or a text description (no side effects, no credits).',
      paramsHint: '{ "url"?: "https://...", "name"?: string, "description"?: string }',
      paramsSchema: z
        .object({
          url: z.string().url().max(2048).optional(),
          name: z.string().min(1).max(300).optional(),
          description: z.string().min(1).max(8000).optional(),
        })
        .refine((d) => d.url || (d.name && d.description), {
          message: 'Provide either url or name+description',
        }),
      permission: 'customer',
      async execute(_ctx, args) {
        const { url, name, description } = args as {
          url?: string;
          name?: string;
          description?: string;
        };
        if (url) {
          const result = await deps.analysis.analyzeFromUrl(url);
          return result;
        }
        return deps.analysis.analyzeFromText({ name: name!, description: description! });
      },
    },
    {
      name: 'product.intelligence',
      description: 'Get the full marketing intelligence of a saved product (profile, audience, angles).',
      paramsHint: '{ "productId": "uuid" }',
      paramsSchema: productIdParam,
      permission: 'customer',
      async execute(ctx, args) {
        return deps.products.getIntelligence(ctx.userId, (args as { productId: string }).productId);
      },
    },
    {
      name: 'product.hooks',
      description: 'Generate marketing hooks for a saved product.',
      paramsHint: '{ "productId": "uuid" }',
      paramsSchema: productIdParam,
      permission: 'customer',
      async execute(ctx, args) {
        return deps.products.generateHooks(ctx.userId, (args as { productId: string }).productId);
      },
    },
  ];
}
