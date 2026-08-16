import { AppError } from '@aura/shared';
import type { ProductIntelligence, ProductRecord } from '@aura/types';
import type { Database } from '../src/db/client.js';
import { ProductService } from '../src/modules/products/services/product.service.js';
import {
  DbProductIntelligenceRepository,
  type ProductIntelligenceRepository,
  type ProductIntelligenceRecord,
} from '../src/modules/products/services/product-intelligence.repository.js';

type PendingWrite =
  | {
      kind: 'ready';
      productId: string;
      intelligence: ProductIntelligence;
      extracted: null;
    }
  | {
      kind: 'failed';
      productId: string;
      errorCode: string;
    };

/**
 * Small deterministic database double. It models the unique product row and
 * the version/status transitions performed by the repository so this test can
 * run without PostgreSQL while still exercising the repository mapping logic.
 */
class FakeDatabase {
  private row: ProductIntelligenceRecord | null = null;
  private pending: PendingWrite | null = null;

  expectReady(productId: string, intelligence: ProductIntelligence): void {
    this.pending = { kind: 'ready', productId, intelligence, extracted: null };
  }

  expectFailed(productId: string, errorCode: string): void {
    this.pending = { kind: 'failed', productId, errorCode };
  }

  async execute(_query: unknown): Promise<unknown> {
    if (this.pending) {
      const write = this.pending;
      this.pending = null;
      const version = (this.row?.version ?? 0) + 1;
      this.row =
        write.kind === 'ready'
          ? {
              productId: write.productId,
              version,
              status: 'ready',
              intelligence: write.intelligence,
              extracted: write.extracted,
              errorCode: null,
              updatedAt: new Date('2026-08-15T19:00:00.000Z').toISOString(),
            }
          : {
              productId: write.productId,
              version,
              status: 'failed',
              intelligence: null,
              extracted: null,
              errorCode: write.errorCode,
              updatedAt: new Date('2026-08-15T19:00:00.000Z').toISOString(),
            };
      return { rows: [] };
    }
    return { rows: this.row ? [this.row] : [] };
  }
}

const productId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const intelligence = {
  productProfile: { category: 'home', brand: null, features: [], specifications: [], facts: ['Desk lamp'] },
  marketingProfile: { primaryBenefit: 'Light', secondaryBenefits: [], painPoints: [], objections: [], differentiators: [] },
  audienceProfile: { demographics: [], interests: [], useCases: ['desk work'], buyingMotivations: [] },
  sellingPoints: ['Simple lighting'],
  marketingAngles: [],
  contentRecommendations: { hooks: ['Light your desk'], ctaSuggestions: [], visualStyle: 'clean', tone: 'clear' },
  analysis: {} as ProductIntelligence['analysis'],
  extracted: null,
  confidence: 0.8,
} as ProductIntelligence;

const product = {
  id: productId,
  workspaceId: '00000000-0000-4000-8000-000000000003',
  userId,
  name: 'Desk lamp',
  description: 'A lamp',
  imageUrl: null,
  imageAssetId: null,
  price: null,
  currency: null,
  externalId: null,
  externalSource: 'text',
  metadata: { intelligence },
  createdAt: '2026-08-15T19:00:00.000Z',
  updatedAt: '2026-08-15T19:00:00.000Z',
} as ProductRecord;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}`);
  }
}

async function main(): Promise<void> {
  console.log('Scenario 1: product intelligence versions are retained on the current record');
  const db = new FakeDatabase();
  const repository = new DbProductIntelligenceRepository(db as unknown as Database);

  db.expectReady(productId, intelligence);
  const first = await repository.saveReady(productId, intelligence, null);
  check('first ready write starts at version 1', first.version === 1 && first.status === 'ready');
  check('first intelligence can be read back', first.intelligence?.contentRecommendations.tone === 'clear');

  db.expectReady(productId, { ...intelligence, confidence: 0.9 });
  const second = await repository.saveReady(productId, { ...intelligence, confidence: 0.9 }, null);
  check('second ready write increments the version', second.version === 2 && second.status === 'ready');
  const current = await repository.getByProductId(productId);
  check('latest version is returned by product id', current?.version === 2 && current.intelligence?.confidence === 0.9);

  console.log('Scenario 2: failures replace stale ready state');
  db.expectFailed(productId, 'AI_PROVIDER_ERROR');
  await repository.markFailed(productId, 'AI_PROVIDER_ERROR');
  const failure = await repository.getByProductId(productId);
  check('failure increments the version', failure?.version === 3);
  check('failure clears intelligence', failure?.status === 'failed' && failure.intelligence === null);
  check('failure code is persisted', failure?.errorCode === 'AI_PROVIDER_ERROR');

  console.log('Scenario 3: service does not serve stale metadata after a failed refresh');
  const failedRepository: ProductIntelligenceRepository = {
    getByProductId: async () => failure,
    saveReady: async () => { throw new Error('not used'); },
    markFailed: async () => undefined,
  };
  const service = new ProductService(
    { findByIdForUser: async () => product } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    null,
    failedRepository,
  );

  let refusedStaleData = false;
  try {
    await service.getIntelligence(userId, productId);
  } catch (err) {
    refusedStaleData = err instanceof AppError && err.code === 'PRODUCT_INTELLIGENCE_FAILED';
  }
  check('failed stored intelligence is surfaced instead of stale metadata', refusedStaleData);

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test harness failed:', err);
  process.exit(1);
});
