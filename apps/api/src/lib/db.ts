import { db } from '@soloquest/db';

/**
 * A Drizzle handle that is either the top-level client or the transaction handle
 * drizzle passes to db.transaction(cb). Both expose the same query-builder surface,
 * so helpers accept this type to work identically in and out of a transaction.
 */
export type DrizzleDB =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];
