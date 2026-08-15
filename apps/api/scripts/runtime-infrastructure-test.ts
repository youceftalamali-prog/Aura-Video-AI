import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Redis } from 'ioredis';
import { loadEnv } from '@aura/config';
import * as schema from '../src/db/schema.js';
import { CreditLedgerService } from '../src/modules/video/services/credit-ledger.service.js';

const { Pool } = pg;

const requiredTables = [
  'users',
  'workspaces',
  'products',
  'projects',
  'assets',
  'product_intelligence',
  'video_generation_jobs',
  'credit_wallets',
  'subscriptions',
  'paypal_webhook_events',
  'ai_provider_configs',
];

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function expectFailure(
  label: string,
  expectedCode: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  try {
    await operation();
    check(label, false, `expected ${expectedCode}`);
  } catch (error) {
    const code = (error as { code?: string }).code;
    check(label, code === expectedCode, `received ${code ?? 'unknown'}`);
  }
}

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    max: 4,
  });
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 10_000,
  });
  const readinessKey = `${env.REDIS_PREFIX}runtime-readiness:${process.pid}`;

  try {
    console.log('Scenario 1: PostgreSQL connectivity and migrations');
    const ping = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    check('PostgreSQL accepts queries', ping.rows[0]?.ok === 1);

    const migration = await pool.query<{ table_name: string | null }>(
      "SELECT to_regclass('public.__drizzle_migrations') AS table_name",
    );
    check('Drizzle migration table exists', migration.rows[0]?.table_name === '__drizzle_migrations');

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [requiredTables],
    );
    const found = new Set(tables.rows.map((row) => row.table_name));
    for (const table of requiredTables) {
      check(`required table exists: ${table}`, found.has(table));
    }

    const intelligenceColumns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'product_intelligence'
         AND column_name = ANY($1::text[])`,
      [['version', 'status', 'intelligence', 'error_code']],
    );
    const columns = new Set(intelligenceColumns.rows.map((row) => row.column_name));
    check('Product Intelligence version column exists', columns.has('version'));
    check('Product Intelligence status column exists', columns.has('status'));
    check('Product Intelligence payload column exists', columns.has('intelligence'));
    check('Product Intelligence error column exists', columns.has('error_code'));

    const projectColumns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'projects'
         AND column_name = 'video_asset_id'`,
    );
    check('Projects canonical video_asset_id column exists', projectColumns.rows.length === 1);

    const projectForeignKey = await pool.query<{ constraint_name: string }>(
      `SELECT tc.constraint_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.constraint_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'projects'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND tc.constraint_name = 'projects_video_asset_id_assets_id_fk'
         AND ccu.table_name = 'assets'
         AND ccu.column_name = 'id'`,
    );
    check('Projects video asset foreign key exists', projectForeignKey.rows.length === 1);

    const staleProjectUrls = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count
       FROM projects
       WHERE video_url IS NOT NULL`,
    );
    check('No persisted project video URLs remain', staleProjectUrls.rows[0]?.count === 0);

    console.log('Scenario 2: Redis connectivity and read/write round trip');
    await redis.connect();
    check('Redis responds to PING', (await redis.ping()) === 'PONG');
    await redis.set(readinessKey, 'ok', 'EX', 30);
    check('Redis stores readiness value', (await redis.get(readinessKey)) === 'ok');
    await redis.del(readinessKey);
    check('Redis readiness key can be removed', (await redis.exists(readinessKey)) === 0);

    console.log('Scenario 3: atomic credit ledger, idempotency, and refund bounds');
    const database = drizzle(pool, { schema });
    const ledger = new CreditLedgerService(database);
    const testUserId = randomUUID();
    const testWorkspaceId = randomUUID();

    try {
      await pool.query(
        `INSERT INTO users (id, email, full_name)
         VALUES ($1, $2, $3)`,
        [testUserId, `runtime-${testUserId}@example.test`, 'Runtime Credit Test'],
      );
      await pool.query(
        `INSERT INTO workspaces (id, name, slug, owner_id)
         VALUES ($1, $2, $3, $4)`,
        [testWorkspaceId, 'Runtime Credit Test', `runtime-${testWorkspaceId.slice(0, 8)}`, testUserId],
      );

      check(
        'first grant creates wallet with expected balance',
        (await ledger.grant(testWorkspaceId, 100, { idempotencyKey: 'runtime:grant:1' })) === 100,
      );
      check(
        'repeated grant is idempotent',
        (await ledger.grant(testWorkspaceId, 100, { idempotencyKey: 'runtime:grant:1' })) === 100,
      );
      check(
        'deduction reduces balance atomically',
        (await ledger.deduct(testWorkspaceId, 40, { idempotencyKey: 'runtime:usage:1' })) === 60,
      );
      check(
        'repeated deduction is idempotent',
        (await ledger.deduct(testWorkspaceId, 40, { idempotencyKey: 'runtime:usage:1' })) === 60,
      );
      check(
        'refund restores balance atomically',
        (await ledger.refund(testWorkspaceId, 40, { idempotencyKey: 'runtime:refund:1' })) === 100,
      );
      check(
        'repeated refund is idempotent',
        (await ledger.refund(testWorkspaceId, 40, { idempotencyKey: 'runtime:refund:1' })) === 100,
      );

      await expectFailure(
        'rejects idempotency key reuse for a different amount',
        'CREDIT_MUTATION_CONFLICT',
        () => ledger.grant(testWorkspaceId, 101, { idempotencyKey: 'runtime:grant:1' }),
      );
      await expectFailure(
        'rejects deduction larger than balance',
        'INSUFFICIENT_CREDITS',
        () => ledger.deduct(testWorkspaceId, 1_000, { idempotencyKey: 'runtime:usage:insufficient' }),
      );

      await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          ledger.deduct(testWorkspaceId, 10, { idempotencyKey: `runtime:concurrent:${index}` }),
        ),
      );
      check('concurrent deductions preserve the wallet lock', (await ledger.getBalance(testWorkspaceId)) === 50);
      await expectFailure(
        'rejects refund larger than net used credits',
        'CREDIT_REFUND_EXCEEDS_USAGE',
        () => ledger.refund(testWorkspaceId, 60, { idempotencyKey: 'runtime:refund:oversized' }),
      );

      const wallet = await pool.query<{ balance: number; lifetime_granted: number; lifetime_used: number }>(
        `SELECT balance, lifetime_granted, lifetime_used
         FROM credit_wallets
         WHERE workspace_id = $1`,
        [testWorkspaceId],
      );
      check(
        'wallet counters remain consistent',
        wallet.rows[0]?.balance === 50
          && wallet.rows[0]?.lifetime_granted === 100
          && wallet.rows[0]?.lifetime_used === 50,
      );
      const transactions = await pool.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM credit_transactions
         WHERE workspace_id = $1`,
        [testWorkspaceId],
      );
      check('idempotent retries do not create duplicate ledger rows', transactions.rows[0]?.count === 8);
    } finally {
      await pool.query('DELETE FROM workspaces WHERE id = $1', [testWorkspaceId]).catch(() => undefined);
      await pool.query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => undefined);
    }

    console.log(`Result: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await redis.quit().catch(() => redis.disconnect());
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Runtime readiness failed:', err);
  process.exit(1);
});
