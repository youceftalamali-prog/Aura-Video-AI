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

const ASPECT_RATIOS = ['9:16', '9:16', '9:16', '1:1', '16:9'];

type SceneType = 'hook' | 'product' | 'closeup' | 'lifestyle' | 'cta';

const SCENE_TITLES: Record<SceneType, string> = {
  hook: 'Hook',
  product: 'Showcase',
  closeup: 'Detail',
  lifestyle: 'Lifestyle',
  cta: 'CTA',
};

const SCENE_PATTERNS: Array<{ name: string; scenes: Array<{ type: SceneType; duration: number }> }> = [
  { name: 'Classic', scenes: [hook(2.5), product(4), lifestyle(4), cta(3.5)] },
  { name: 'Detail', scenes: [hook(3), closeup(4), product(4), cta(3)] },
  { name: 'Full Story', scenes: [hook(2.5), closeup(3.5), lifestyle(4), product(3), cta(2.5)] },
  { name: 'Quick', scenes: [product(4), closeup(4), cta(3)] },
  { name: 'Direct', scenes: [hook(3), product(5), cta(4)] },
  { name: 'Story', scenes: [hook(3), lifestyle(5), cta(3), product(4)] },
];

function hook(duration: number) { return { type: 'hook' as const, duration }; }
function product(duration: number) { return { type: 'product' as const, duration }; }
function closeup(duration: number) { return { type: 'closeup' as const, duration }; }
function lifestyle(duration: number) { return { type: 'lifestyle' as const, duration }; }
function cta(duration: number) { return { type: 'cta' as const, duration }; }

interface CategoryRecipe {
  catName: string;
  stems: string[];
  flavors: string[];
  setting: string;
  detail: string;
  lifestyleLine: string;
  supported: string[];
  tags: string[];
  subCategories?: string[];
}

const CATEGORY_RECIPES: Record<string, CategoryRecipe> = {
  jewelry: {
    catName: 'Jewelry',
    stems: [
      'Luxury Jewelry Showcase', 'Gold Necklace Spotlight', 'Diamond Ring Moment', 'Elegant Jewelry Close-Up',
      'Pearl Elegance', 'Rose Gold Glow', 'Statement Piece Reveal', 'Bridal Collection', 'Timeless Classic',
      'Vintage Charm', 'High-End Hero', 'Solitaire Story', 'Charm Bracelet Tales', 'Night Out Luxe', 'Fine Craft Detail',
      'Modern Minimal Gold', 'Signature Sparkle', 'Everyday Elegance', 'Bold and Bright', 'Soft Romance', 'Royal Radiance',
      'Twinkle Tales', 'Lux Express', 'Aura Signature Jewelry',
    ],
    flavors: ['luxury', 'elegant', 'premium', 'romantic'],
    setting: 'elegant dark studio, soft golden spotlight, cinematic shallow depth of field',
    detail: 'macro craftsmanship, metal reflections and sparkling facets, precision focus',
    lifestyleLine: 'a refined fashion moment with jewelry worn elegantly',
    supported: ['rings', 'necklaces', 'bracelets', 'earrings', 'jewelry'],
    tags: ['luxury', 'gold', 'premium', 'sparkle'],
    subCategories: ['luxury', 'rings', 'necklaces', 'bracelets', 'earrings'],
  },
  fashion: {
    catName: 'Fashion',
    stems: [
      'Fashion Product Showcase', 'Minimal Fashion Ad', 'Premium Clothing Reveal', 'Street Style Drop', 'Luxury Apparel Story',
      'Boho Chic Moments', 'Tailored Elegance', 'Urban Edge', 'Runway Moment', 'Classic Wardrobe', 'Denim Days',
      'Silk and Satin', 'Monochrome Style', 'Bold Pattern Play', 'Everyday Basics', 'Evening Glam', 'Athleisure Cool',
      'Heritage Craft', 'Trend Spotlight', 'Capsule Collection', 'Summer Breeze Look', 'Winter Layers', 'Signature Fit',
      'Parisian Chic',
    ],
    flavors: ['editorial', 'modern', 'minimal', 'premium'],
    setting: 'minimal studio backdrop, soft diffused light, fashion editorial look',
    detail: 'macro fabric texture, stitching and tailoring finish, tactile feel',
    lifestyleLine: 'a stylish everyday scene with the item styled naturally',
    supported: ['clothing', 'apparel', 'fashion', 'accessories'],
    tags: ['fashion', 'lookbook', 'style', 'premium'],
    subCategories: ['women', 'men', 'casual', 'luxury'],
  },
  sportswear: {
    catName: 'Sportswear',
    stems: [
      'Fitness Product Ad', 'Athletic Product Showcase', 'Dynamic Sportswear', 'Running Performance', 'Gym Motivation',
      'High-Energy Training', 'Sportswear Essentials', 'Marathon Focus', 'Yoga and Flow', 'Team Spirit', 'Strength Series',
      'Speed Demon', 'No Limits', 'Recovery Mode', 'Core Power', 'Fresh Start Routine', 'Outdoor Explorer',
      'Sport Performance', 'Bootcamp Energy', 'Race Day', 'Sweat and Shine', 'Pro Athlete', 'Endurance Test',
      'Game Changer Sportswear',
    ],
    flavors: ['energetic', 'athletic', 'inspirational', 'dynamic'],
    setting: 'high-energy gym or outdoor athletic environment, dynamic lighting',
    detail: 'macro fabric weave, breathable mesh and performance detail, sweat-grade material',
    lifestyleLine: 'a training or workout moment in motion',
    supported: ['sportswear', 'fitness', 'running', 'athletic'],
    tags: ['fitness', 'energy', 'performance'],
    subCategories: ['fitness', 'running', 'gym', 'yoga'],
  },
  shoes: {
    catName: 'Shoes',
    stems: [
      'Sneaker Showcase', 'Premium Shoe Reveal', 'Street Heat', 'Sole Story', 'Running Starter', 'Classic Kicks',
      'Lux Leather', 'Casual Comfort', 'Bold Traction', 'Court Classic', 'Trail Blazer', 'Evening Heels',
      'Everyday Walk', 'High-Top Hero', 'Slip-On Ease', 'Sport Sprint', 'Statement Lace', 'Minimal White',
      'Retro Throwback', 'Urban Sneaker', 'Lightweight Lover', 'Her Sole Rising', 'First Step', 'Fast Lane',
    ],
    flavors: ['streetwear', 'premium', 'clean', 'bold'],
    setting: 'studio or urban backdrop with dramatic side lighting, product-first framing',
    detail: 'macro sole, stitching and material detail, wear-and-tear appeal',
    lifestyleLine: 'a confident on-the-move scene during everyday wear',
    supported: ['sneakers', 'shoes', 'footwear'],
    tags: ['sneakers', 'street', 'comfort'],
    subCategories: ['sneakers', 'luxury', 'casual', 'sports'],
  },
  beauty: {
    catName: 'Beauty',
    stems: [
      'Cosmetic Product Showcase', 'Luxury Beauty Ad', 'Perfume Showcase', 'Skincare Ritual', 'Makeup Masterclass',
      'Glow Essentials', 'Flawless Finish', 'Scent of Elegance', 'Nail Polish Pop', 'Fresh Face', 'Evening Makeup',
      'Serum Secrets', 'Hydration Hero', 'Bright Eyes', 'Velvet Lips', 'Daily Glow', 'Spa Retreat', 'Anti-Aging Care',
      'Clean Beauty', 'Blush and Bloom', 'Radiance Boost', 'Smoky Eyes', 'Beauty Bare', 'Signature Scent',
    ],
    flavors: ['glowing', 'fresh', 'luxury', 'soft'],
    setting: 'bright soft beauty lighting, clean cosmetics ambiance, pampering mood',
    detail: 'macro texture of the formula, elegant packaging, radiant highlights',
    lifestyleLine: 'a daily beauty or spa ritual moment',
    supported: ['cosmetics', 'skincare', 'makeup', 'perfume'],
    tags: ['beauty', 'skincare', 'glow'],
    subCategories: ['cosmetics', 'skincare', 'makeup', 'perfume'],
  },
  watches: {
    catName: 'Watches',
    stems: [
      'Luxury Watch Showcase', 'Premium Watch Reveal', 'Chronograph Focus', 'Smart Watch Life', 'Classic Timepiece',
      'Athleisure Watch', 'Heritage Craft', 'Midnight Dial', 'Rose Gold Time', 'Business Class', 'Sport Chrono',
      'Minimal Modern', 'Automatic Movement', 'Diver Watch', 'Slim Elegance', 'Weekend Classic', 'Aviation Pilot',
      'Precision Perfection', 'Rotating Bezel', 'Moon and Stars', 'Chrono Life', 'Gentle Gold', 'Daily Driver',
      'Statement Time',
    ],
    flavors: ['precision', 'luxury', 'modern', 'classic'],
    setting: 'dramatic close-up studio with shallow focus and reflective metal accents',
    detail: 'macro dial, hands and movement detail, engineered precision',
    lifestyleLine: 'a refined lifestyle scene on the wrist in everyday situations',
    supported: ['watches', 'smartwatches'],
    tags: ['luxury', 'watch', 'precision'],
    subCategories: ['luxury', 'smart', 'classic', 'sport'],
  },
  bags: {
    catName: 'Bags & Accessories',
    stems: [
      'Handbag Showcase', 'Leather Backpack Story', 'Everyday Tote', 'Crossbody Chic', 'Luxury Satchel',
      'Minimal Clutch', 'Weekend Duffel', 'Office Essential', 'Street Style Carry', 'Travel Companion', 'Evening Bag',
      'Canvas Utility', 'Quilted Classic', 'Belt Bag Buzz', 'Structured Tote', 'Soft Leather', 'Festival Flare',
      'City Explorer', 'Pocket Perfect', 'Royal Revival', 'Eco Canvas', 'Slim Wallet Set', 'Golden Hour Carry',
      'Signature Carry',
    ],
    flavors: ['functional', 'luxury', 'minimal', 'versatile'],
    setting: 'clean studio scenes and city lifestyle backdrops, balanced natural light',
    detail: 'macro stitching, leather texture and hardware detail',
    lifestyleLine: 'a stylish carry moment during a daily commute or travel',
    supported: ['handbags', 'backpacks', 'totes', 'accessories'],
    tags: ['bags', 'leather', 'travel'],
    subCategories: ['handbags', 'backpacks', 'totes', 'accessories'],
  },
  electronics: {
    catName: 'Electronics',
    stems: [
      'Gadget Reveal', 'Smart Home Hero', 'Premium Tech Unboxing', 'Wireless Freedom', 'Power and Speed',
      'Design Forward', 'Everyday Tech', 'Gaming Setup', 'Home Office Pro', 'Audio Immersion', 'Visual Spectacle',
      'Battery Life', 'Ultra Slim', 'Smart Living', 'Future Ready', 'Connectivity Boost', 'Folding Forward',
      'Travel Tech', 'Privacy Shield', 'Creator Kit', 'Neon Nights', 'Classic Tech', 'Budget Brilliance',
      'Ultimate Upgrade',
    ],
    flavors: ['futuristic', 'premium', 'clean', 'dynamic'],
    setting: 'sleek product studio with blue accent lighting, modern tech aesthetic',
    detail: 'macro ports, texture and display detail, engineered design',
    lifestyleLine: 'a modern smart-living scene using the device',
    supported: ['electronics', 'gadgets', 'devices', 'tech'],
    tags: ['tech', 'gadgets', 'modern'],
    subCategories: ['gadgets', 'audio', 'gaming', 'home'],
  },
  food: {
    catName: 'Food & Beverage',
    stems: [
      'Gourmet Food Spotlight', 'Fresh Flavor Burst', 'Artisan Kitchen', 'Beverage Ice Pop', 'Home Cooking Joy',
      'Spice and Sizzle', 'Breakfast Bliss', 'Cozy Brunch', 'Good Mood Meals', 'Organic Harvest', 'Quick and Easy',
      'Family Feast', 'Party Bites', 'Dessert Dreams', 'Healthy Bowl', 'Coffee Ritual', 'Smoothie Boost',
      'Snack Attack', 'BBQ Summer', 'Winter Warmers', 'Local Farm', 'Sweet Sunday', 'Umami Works', 'First Bite',
    ],
    flavors: ['appetizing', 'fresh', 'warm', 'vibrant'],
    setting: 'bright kitchen or dining scene, natural light, mouthwatering plating',
    detail: 'macro textures, steam, drips and ingredients, food-porn close-up',
    lifestyleLine: 'a joyful sharing and eating moment with family or friends',
    supported: ['food', 'beverages', 'snacks', 'gourmet'],
    tags: ['food', 'appetizing', 'fresh'],
    subCategories: ['gourmet', 'beverage', 'snacks', 'meals'],
  },
  home: {
    catName: 'Home & Furniture',
    stems: [
      'Home and Furniture Spotlight', 'Cozy Living Room', 'Modern Minimal Home', 'Functional Kitchen', 'Bedroom Serenity',
      'Workspace Elegance', 'Outdoor Living', 'Smart Home Upgrade', 'DIY Home Project', 'Vintage Revival',
      'Scandinavian Style', 'Greenery Haven', 'Family Room Comfort', 'Luxe Living', 'Space Saver', 'Textile Texture',
      'Light and Airy', 'Rustic Charm', 'Home Office Focus', 'Entertainer Kitchen', 'Cozy Corner', 'Artful Details',
      'Sleep Sanctuary', 'Open Concept',
    ],
    flavors: ['warm', 'minimal', 'coastal', 'urban'],
    setting: 'stylized interior scenes, soft natural window light, homely atmosphere',
    detail: 'macro texture of materials, wood grain and soft textiles, inviting craft',
    lifestyleLine: 'a comfortable everyday home scene, warm and lived in',
    supported: ['furniture', 'home decor', 'kitchen', 'interiors'],
    tags: ['home', 'furniture', 'cozy'],
    subCategories: ['furniture', 'decor', 'kitchen', 'bedroom'],
  },
  automotive: {
    catName: 'Automotive',
    stems: [
      'Car Care Reveal', 'Auto Accessory Showcase', 'Interior Detail', 'Performance Upgrade', 'Weekend Detail',
      'Road Trip Ready', 'Engine Excellence', 'Wheel and Tire Glow', 'Tech Cockpit', 'Headlight Hero',
      'Interior Luxury', 'GPS Navigation', 'Safety First', 'Off-Road Ready', 'Showroom Shine', 'Custom Build',
      'Sound System', 'Winter Ready', 'Aero Style', 'Fast and Furious Lite', 'Family SUV Ready', 'Auto Detailing Pro',
      'Spark Plug Spark', 'Clean Machine',
    ],
    flavors: ['sleek', 'powerful', 'premium', 'practical'],
    setting: 'studio or garage scenes with dramatic rim lighting, automotive gloss',
    detail: 'macro brushed metal, stitching and detailing, showroom finish',
    lifestyleLine: 'a road-ready lifestyle moment with the vehicle accessory',
    supported: ['car accessories', 'auto parts', 'automotive'],
    tags: ['automotive', 'car', 'performance'],
    subCategories: ['car-care', 'accessories', 'interior', 'performance'],
  },
  'real-estate': {
    catName: 'Real Estate',
    stems: [
      'Property Showcase', 'Lux Home Tour', 'Modern Apartment', 'Cozy Starter Home', 'Dream Villa', 'City View Live',
      'Suburban Oasis', 'Renovated Gem', 'New Build Reveal', 'Garden Retreat', 'Penthouse Living', 'Loft Conversion',
      'Townhouse Charm', 'Investment Pick', 'First-Time Buyer', 'Family Home Tour', 'Near Transit', 'Waterfront View',
      'Smart Home Tour', 'Rental Ready', 'Elegant Entrance', 'Sunlit Spaces', 'Neighborhood Guide', 'Closing Day',
    ],
    flavors: ['bright', 'premium', 'spacious', 'inviting'],
    setting: 'airy interior walkthroughs with abundant natural light, architectural beauty',
    detail: 'macro design details, moldings, finishes and fixtures, quality craft',
    lifestyleLine: 'a lifestyle moment showing the property as home',
    supported: ['property', 'apartments', 'villas', 'real estate'],
    tags: ['real-estate', 'property', 'home'],
    subCategories: ['property', 'apartment', 'villa', 'investment'],
  },
};

export type Seed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  subCategory?: string;
  durationSeconds: number;
  aspectRatio: string;
  tags: string[];
  supportedProductTypes: string[];
  isFeatured?: boolean;
  scenes: LibraryTemplateSceneDefinition[];
};

function buildVisualPrompt(type: SceneType, flavor: string, category: CategoryRecipe): string {
  const productToken = '{{product}}';
  const flavorWord = flavor ? `, ${flavor} mood` : '';
  switch (type) {
    case 'hook':
      return `Cinematic opening intro of ${productToken}${flavorWord}, ${category.setting}, attention-grabbing first frame`;
    case 'product':
      return `Hero product shot of ${productToken}, centered${flavorWord}, ${category.setting}, premium commercial lighting`;
    case 'closeup':
      return `Macro detail shot of ${productToken}, ${category.detail}${flavorWord}`;
    case 'lifestyle':
      return `Lifestyle scene, ${category.lifestyleLine}${flavorWord}, ${category.setting}`;
    case 'cta':
      return `CTA frame, ${productToken} hero shot with brand logo area and call-to-action space, ${category.setting}, ${category.catName} style`;
  }
}

export const TEMPLATE_SEEDS: Seed[] = (() => {
  const seeds: Seed[] = [];
  for (const [slug, recipe] of Object.entries(CATEGORY_RECIPES)) {
    recipe.stems.forEach((name, i) => {
      const pattern = SCENE_PATTERNS[i % SCENE_PATTERNS.length]!;
      const flavor = recipe.flavors[i % recipe.flavors.length]!;
      const aspectRatio = ASPECT_RATIOS[i % ASPECT_RATIOS.length]!;
      const slugified = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const scenes: LibraryTemplateSceneDefinition[] = pattern.scenes.map((s, idx) => ({
        order: idx + 1,
        type: s.type,
        title: SCENE_TITLES[s.type],
        durationSeconds: s.duration,
        visualPromptTemplate: buildVisualPrompt(s.type, flavor, recipe),
        productPlacement: s.type === 'product' || s.type === 'closeup' ? 'center' : undefined,
        textPlaceholder: s.type === 'cta' ? 'Shop now' : s.type === 'hook' ? 'Discover' : undefined,
        transition: 'fade',
      }));
      const subCategory = recipe.subCategories ? recipe.subCategories[i % recipe.subCategories.length] : undefined;
      const durationSeconds = Math.round(scenes.reduce((a, s) => a + s.durationSeconds, 0));
      seeds.push({
        slug: slugified,
        name,
        description: `${name}: professional ${recipe.catName} advertising template in ${aspectRatio} format, optimized for short-form product ads.`,
        category: slug,
        subCategory,
        durationSeconds,
        aspectRatio,
        tags: [...recipe.tags, flavor, pattern.name.toLowerCase()],
        supportedProductTypes: recipe.supported,
        isFeatured: i < 4 ? true : undefined,
        scenes,
      });
    });
  }
  return seeds;
})();

export function categorySlugList(): string[] {
  return TEMPLATE_CATEGORIES.map((c) => c.slug);
}