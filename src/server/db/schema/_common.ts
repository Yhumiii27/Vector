import { sql, type SQL } from 'drizzle-orm';
import { timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';

/** Primary key: a random UUID. */
export const id = () => uuid('id').primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/** CHECK col IN ('a', 'b') — the closed vocabularies of src/domain/vocab.ts (Norma § 4: formats live in the database). */
export const inList = (col: AnyPgColumn, values: readonly string[]): SQL => sql`${col} in (${sql.raw(values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', '))})`;

/** CHECK col ~ 'regexp' (a format of src/domain/vocab.ts, PG_FORMATS). */
export const matches = (col: AnyPgColumn, re: string): SQL => sql`${col} ~ ${sql.raw(`'${re.replace(/'/g, "''")}'`)}`;

/** CHECK btrim(col) <> '' (a name that is not empty). */
export const notBlank = (col: AnyPgColumn): SQL => sql`btrim(${col}) <> ''`;
