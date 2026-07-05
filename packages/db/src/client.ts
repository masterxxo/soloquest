import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// The live DB connection. Import this only from runtime code (never from
// type-only or table-only importers) so that pulling in the schema/types does
// not eagerly open a Postgres connection.
const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
