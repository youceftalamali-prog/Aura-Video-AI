import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, closeDb } from './client.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const db = getDb();
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') });
  console.log('Migrations completed successfully.');
  await closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
