// Vector's place on a PostgreSQL server — the shared EPC2I server (decision M-01 in Matrix: one database `epc2i`, one schema
// per tool; Vector connects as `vector_app`, owner of the schema `vector` and of nothing else, N-1). Vector runs on PostgreSQL
// only (owner, 22 Oct 2026): a developer machine and the CI use the same layout (`npm run db:local` creates it there).
// - tables are declared in the schema (`vector.table(…)`, ./schema/_schema.ts), so migrations name `"vector".` themselves;
// - the journal is `vector.__drizzle_migrations`, written under the advisory lock `pg_advisory_lock(hashtext('vector.migrations'))`
//   taken before the journal is created or read; Vector never runs CREATE SCHEMA (vector_app may not);
// - every transaction first takes `pg_advisory_xact_lock(hashtext('vector.ecritures'))` (writes one at a time, Matrix plan §4.5).
// No `server-only`: scripts and tests load it under plain Node.

/** Schema of Vector's tables, views and migration journal. */
export const SERVER_SCHEMA = 'vector';

/** Connection parameter of every connection (pool, scripts): unqualified names resolve in `vector`. */
export const SERVER_CONNECTION_OPTIONS = `-c search_path=${SERVER_SCHEMA}`;

/** Key text of the session advisory lock held while migrating and seeding. */
export const MIGRATION_LOCK_NAME = `${SERVER_SCHEMA}.migrations`;

/** Key text of the transaction advisory lock every transaction takes first. */
export const WRITE_LOCK_NAME = `${SERVER_SCHEMA}.ecritures`;

/** The migration journal (same table and columns as Drizzle's migrator). */
export const JOURNAL_TABLE = `"${SERVER_SCHEMA}"."__drizzle_migrations"`;
