import type { LibraryTemplateCategory, LibraryTemplateSceneDefinition } from '@aura/types';

export const TEMPLATE_CATEGORIES: Omit<LibraryTemplateCategory, 'templateCount'>[] = [
  { slug: 'jewelry', name: 'Jewelry', description: 'Rings, necklaces, bracelets, earrings and luxury jewelry.', previewGradient: 'from-amber-700 via-yellow-600 to-amber-900', sortOrder: 1 },
  { slug: 'fashion', name: 'Fashion', description: "Women's & men's clothing, casual and luxury fashion.", previewGradient: 'from-rose-600 via-pink-500 to-fuchsia-700', sortOrder: 2 },
  { slug: 'sportswear', name: 'Sportswear', description: 'Fitness, running, gym and athletic products.', previewGradient: 'from-emerald-600 via-teal-500 to-cyan-700', sortOrder: 3 },
  { slug: 'shoes', name: 'Shoes', description: 'Sneakers, luxury shoes, casual and sports footwear.', previewGradient: 'from-slate-700 via-zinc-600 to-neutral-800', sortOrder: 4 },
  { slug: 'beauty', name: 'Beauty', description: 'Cosmetics, skincare, makeup and perfume.', previewGradient: 'from-violet-600 via-purple-500 to-fuchsia-600', sortOrder: 5 },
  { slug: 'watches', name: 'Watches', description: 'Luxury, smart and classic watches.', previewGradient: 'from-stone-700 via-amber-800 to-stone-900', sortOrder: 6 },
  { slug: 'bags', name: 'Bags & Accessories', description: 'Handbags, backpacks and fashion accessories.', previewGradient: 'from-orange-700 via-amber-600 to-yellow-700', sortOrder: 7 },
  { slug: 'electronics', name: 'Electronics', description: 'Gadgets, devices and consumer tech.', previewGradient: 'from-blue-700 via-indigo-600 to-slate-800', sortOrder: 8 },
  { slug: 'food', name: 'Food & Beverage', description: 'Food products, drinks and gourmet brands.', previewGradient: 'from-red-600 via-orange-500 to-amber-600', sortOrder: 9 },
  { slug: 'home', name: 'Home & Furniture', description: 'Home decor, furniture and lifestyle products.', previewGradient: 'from-lime-700 via-green-600 to-emerald-800', sortOrder: 10 },
  { slug: 'automotive', name: 'Automotive', description: 'Car accessories and automotive products.', previewGradient: 'from-zinc-800 via-red-800 to-black', sortOrder: 11 },
  { slug: 'real-estate', name: 'Real Estate', description: 'Property showcase and listing ads.', previewGradient: 'from-sky-700 via-blue-600 to-indigo-800', sortOrder: 12 },
];

function scenes(defs: Array<[string, string, number, string]>): LibraryTemplateSceneDefinition[] {
  return defs.map(([type, title, durationSeconds, visualPromptTemplate], i) => ({
    order: i + 1,
    type,
    title,
    durationSeconds,
    visualPromptTemplate,
    productPlacement: type === 'product' || type === 'closeup' ? 'center' : undefined,
    textPlaceholder: type === 'cta' ? 'Shop now' : type === 'hook' ? 'Discover' : undefined,
    transition: 'fade',
  }));
}

type Seed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  subCategory?: string;
  durationSeconds: number;
  tags: string[];
  supportedProductTypes: string[];
  isFeatured?: boolean;
  scenes: LibraryTemplateSceneDefinition[];
};

export const TEMPLATE_SEEDS: Seed[] = [
  {
    slug: 'luxury-jewelry-showcase',
    name: 'Luxury Jewelry Showcase',
    description: 'Premium gold jewelry on dark elegant backgrounds with soft light.',
    category: 'jewelry',
    subCategory: 'luxury',
    durationSeconds: 15,
    tags: ['luxury', 'gold', 'premium'],
    supportedProductTypes: ['rings', 'necklaces', 'bracelets', 'earrings'],
    isFeatured: true,
    scenes: scenes([
      ['hook', 'Opening', 3, 'Elegant dark background, soft spotlight, {{product}} jewelry product intro, cinematic'],
      ['closeup', 'Close-up', 4, 'Macro close-up of {{product}}, reflective metal, luxury lighting'],
      ['lifestyle', 'Lifestyle', 4, 'Lifestyle scene featuring {{product}} worn elegantly, shallow depth of field'],
      ['cta', 'CTA', 4, 'Clean ending frame with {{product}}, soft glow, call to action space'],
    ]),
  },
  {
    slug: 'premium-product-reveal',
    name: 'Premium Product Reveal',
    description: 'Dramatic reveal for high-end jewelry pieces.',
    category: 'jewelry',
    durationSeconds: 12,
    tags: ['reveal', 'premium'],
    supportedProductTypes: ['rings', 'necklaces'],
    scenes: scenes([
      ['hook', 'Reveal', 4, 'Dark velvet, {{product}} slowly revealed under warm light'],
      ['product', 'Showcase', 5, '{{product}} centered, rotating showcase, premium studio'],
      ['cta', 'CTA', 3, 'Final hero shot of {{product}} with brand space'],
    ]),
  },
  {
    slug: 'elegant-jewelry-close-up',
    name: 'Elegant Jewelry Close-Up',
    description: 'Detail-focused close-ups for craftsmanship.',
    category: 'jewelry',
    durationSeconds: 10,
    tags: ['closeup', 'detail'],
    supportedProductTypes: ['rings', 'earrings', 'bracelets'],
    scenes: scenes([
      ['closeup', 'Detail', 5, 'Extreme close-up craftsmanship of {{product}}'],
      ['product', 'Hero', 3, 'Hero product shot {{product}}'],
      ['cta', 'CTA', 2, 'Simple CTA with {{product}}'],
    ]),
  },
  {
    slug: 'luxury-ring-ad',
    name: 'Luxury Ring Ad',
    description: 'Optimized for ring products and proposals.',
    category: 'jewelry',
    subCategory: 'rings',
    durationSeconds: 15,
    tags: ['ring', 'proposal'],
    supportedProductTypes: ['rings'],
    isFeatured: true,
    scenes: scenes([
      ['hook', 'Sparkle', 3, 'Sparkle light rays, {{product}} ring'],
      ['closeup', 'Detail', 5, 'Diamond facets close-up of {{product}}'],
      ['lifestyle', 'Moment', 4, 'Romantic soft-focus moment featuring {{product}}'],
      ['cta', 'CTA', 3, 'CTA frame {{product}}'],
    ]),
  },
  {
    slug: 'fashion-product-showcase',
    name: 'Fashion Product Showcase',
    description: 'Clean fashion lookbook style for apparel.',
    category: 'fashion',
    durationSeconds: 15,
    tags: ['fashion', 'lookbook'],
    supportedProductTypes: ['clothing', 'apparel'],
    isFeatured: true,
    scenes: scenes([
      ['hook', 'Style', 3, 'Minimal studio, {{product}} fashion item'],
      ['product', 'Fit', 5, '{{product}} product detail and fabric texture'],
      ['lifestyle', 'Wear', 4, 'Lifestyle model wearing {{product}}'],
      ['cta', 'CTA', 3, 'CTA with {{product}}'],
    ]),
  },
  {
    slug: 'minimal-fashion-ad',
    name: 'Minimal Fashion Ad',
    description: 'Minimalist white/beige aesthetic for modern brands.',
    category: 'fashion',
    durationSeconds: 12,
    tags: ['minimal'],
    supportedProductTypes: ['clothing'],
    scenes: scenes([
      ['hook', 'Minimal', 4, 'Beige minimal backdrop, {{product}}'],
      ['product', 'Focus', 5, 'Centered {{product}} soft shadows'],
      ['cta', 'CTA', 3, 'Minimal CTA {{product}}'],
    ]),
  },
  {
    slug: 'premium-clothing-reveal',
    name: 'Premium Clothing Reveal',
    description: 'Dramatic fabric and silhouette reveal.',
    category: 'fashion',
    durationSeconds: 14,
    tags: ['premium', 'reveal'],
    supportedProductTypes: ['clothing', 'luxury fashion'],
    scenes: scenes([
      ['hook', 'Reveal', 4, 'Silhouette reveal of {{product}}'],
      ['product', 'Fabric', 6, 'Fabric texture detail {{product}}'],
      ['cta', 'CTA', 4, 'Hero CTA {{product}}'],
    ]),
  },
  {
    slug: 'fitness-product-ad',
    name: 'Fitness Product Ad',
    description: 'High-energy fitness product ads.',
    category: 'sportswear',
    durationSeconds: 15,
    tags: ['fitness', 'energy'],
    supportedProductTypes: ['sportswear', 'fitness'],
    isFeatured: true,
    scenes: scenes([
      ['hook', 'Energy', 3, 'Dynamic motion, gym energy, {{product}}'],
      ['product', 'Gear', 5, '{{product}} athletic product showcase'],
      ['lifestyle', 'Train', 4, 'Athlete training with {{product}}'],
      ['cta', 'CTA', 3, 'Bold CTA {{product}}'],
    ]),
  },
  {
    slug: 'athletic-product-showcase',
    name: 'Athletic Product Showcase',
    description: 'Performance-focused athletic showcase.',
    category: 'sportswear',
    durationSeconds: 12,
    tags: ['athletic'],
    supportedProductTypes: ['sportswear'],
    scenes: scenes([
      ['hook', 'Start', 3, 'Action start {{product}}'],
      ['product', 'Detail', 5, 'Product detail {{product}}'],
      ['cta', 'CTA', 4, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'dynamic-sportswear',
    name: 'Dynamic Sportswear',
    description: 'Fast cuts and motion for sportswear.',
    category: 'sportswear',
    durationSeconds: 12,
    tags: ['dynamic'],
    supportedProductTypes: ['sportswear', 'running'],
    scenes: scenes([
      ['hook', 'Motion', 4, 'Fast motion blur {{product}}'],
      ['lifestyle', 'Run', 5, 'Running lifestyle {{product}}'],
      ['cta', 'CTA', 3, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'sneaker-showcase',
    name: 'Sneaker Showcase',
    description: 'Street-style sneaker hero shots.',
    category: 'shoes',
    durationSeconds: 12,
    tags: ['sneakers'],
    supportedProductTypes: ['sneakers', 'shoes'],
    isFeatured: true,
    scenes: scenes([
      ['hook', 'Drop', 3, 'Sneaker drop style {{product}}'],
      ['closeup', 'Detail', 5, 'Sole and material detail {{product}}'],
      ['cta', 'CTA', 4, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'premium-shoe-reveal',
    name: 'Premium Shoe Reveal',
    description: 'Luxury footwear reveal.',
    category: 'shoes',
    durationSeconds: 12,
    tags: ['premium', 'shoes'],
    supportedProductTypes: ['shoes', 'luxury shoes'],
    scenes: scenes([
      ['hook', 'Reveal', 4, 'Luxury shoe reveal {{product}}'],
      ['product', 'Hero', 5, 'Hero product {{product}}'],
      ['cta', 'CTA', 3, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'cosmetic-product-showcase',
    name: 'Cosmetic Product Showcase',
    description: 'Clean beauty packaging showcase.',
    category: 'beauty',
    durationSeconds: 12,
    tags: ['cosmetics'],
    supportedProductTypes: ['cosmetics', 'skincare'],
    isFeatured: true,
    scenes: scenes([
      ['hook', 'Glow', 3, 'Soft glow beauty light {{product}}'],
      ['product', 'Pack', 5, 'Packaging hero {{product}}'],
      ['cta', 'CTA', 4, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'luxury-beauty-ad',
    name: 'Luxury Beauty Ad',
    description: 'Premium beauty brand aesthetic.',
    category: 'beauty',
    durationSeconds: 15,
    tags: ['luxury', 'beauty'],
    supportedProductTypes: ['makeup', 'skincare'],
    scenes: scenes([
      ['hook', 'Luxe', 4, 'Luxury vanity {{product}}'],
      ['lifestyle', 'Apply', 6, 'Beauty lifestyle {{product}}'],
      ['cta', 'CTA', 5, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'perfume-showcase',
    name: 'Perfume Showcase',
    description: 'Scent-inspired visual storytelling for fragrance.',
    category: 'beauty',
    subCategory: 'perfume',
    durationSeconds: 12,
    tags: ['perfume'],
    supportedProductTypes: ['perfume', 'fragrance'],
    scenes: scenes([
      ['hook', 'Mist', 4, 'Ethereal mist around {{product}} bottle'],
      ['product', 'Bottle', 5, 'Glass bottle hero {{product}}'],
      ['cta', 'CTA', 3, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'luxury-watch-showcase',
    name: 'Luxury Watch Showcase',
    description: 'Precision and craftsmanship for watches.',
    category: 'watches',
    durationSeconds: 15,
    tags: ['luxury', 'watch'],
    supportedProductTypes: ['watches'],
    isFeatured: true,
    scenes: scenes([
      ['hook', 'Tick', 3, 'Macro watch face {{product}}'],
      ['closeup', 'Craft', 5, 'Craftsmanship details {{product}}'],
      ['lifestyle', 'Wrist', 4, 'On-wrist lifestyle {{product}}'],
      ['cta', 'CTA', 3, 'CTA {{product}}'],
    ]),
  },
  {
    slug: 'premium-watch-reveal',
    name: 'Premium Watch Reveal',
    description: 'Bold reveal for watch launches.',
    category: 'watches',
    durationSeconds: 12,
    tags: ['reveal'],
    supportedProductTypes: ['watches', 'smart watches'],
    scenes: scenes([
      ['hook', 'Reveal', 4, 'Dramatic reveal {{product}}'],
      ['product', 'Hero', 5, 'Hero product {{product}}'],
      ['cta', 'CTA', 3, 'CTA {{product}}'],
    ]),
  },
];

export function categorySlugList(): string[] {
  return TEMPLATE_CATEGORIES.map((c) => c.slug);
}
