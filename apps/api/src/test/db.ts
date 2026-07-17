import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@soloquest/db/schema';
import type { DrizzleDB } from '../lib/db';

// The production migration folder, applied verbatim to the ephemeral pglite so the test
// schema is exactly what prod runs — same DDL, same enums, same constraints.
const MIGRATIONS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/db/migrations',
);

export interface TestDb {
  // Cast to the production DrizzleDB shape: pglite's drizzle client is a different driver
  // flavour but exposes the identical query-builder/transaction surface the code under test
  // uses, so the helpers run against it unchanged. The impedance mismatch is isolated to
  // this one line rather than leaking a driver-specific type across every test.
  db: DrizzleDB;
  close: () => Promise<void>;
}

/**
 * Spin up a fresh in-memory Postgres (pglite, WASM — no Docker, no network) migrated to the
 * current schema. Each call is fully isolated: a brand-new database with nothing in it, which
 * is why tests take one per case and close it after. Nothing here touches the prod/dev DB.
 */
export async function createTestDb(): Promise<TestDb> {
  const client = new PGlite();
  const database = drizzle(client, { schema });
  await migrate(database, { migrationsFolder: MIGRATIONS_DIR });
  return {
    db: database as unknown as DrizzleDB,
    close: () => client.close(),
  };
}
