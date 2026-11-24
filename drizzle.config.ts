import { defineConfig } from 'drizzle-kit';

// Vector's tables live in the schema `vector` (src/server/db/schema/_schema.ts); the journal is vector.__drizzle_migrations.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['vector'],
  migrations: { schema: 'vector', table: '__drizzle_migrations' },
});
