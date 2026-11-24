import 'server-only';
// Seed of an empty database (copied from Keystone, R-011): `demo` (default) loads the demonstration data set, `production`
// the reference data only (applications, standard profiles); the people come from the directory. An already seeded database is left as it is.
import type { SeedMode } from '@/server/config/parse';
import { log } from '@/server/log';
import type { DB } from '../types';
import { seedDemo } from './demo';
import { seedReference } from './reference';
import { readSeedRecord, writeSeedRecord } from './mode';

/** Seeds the database when it has no seed record; returns true when it did. */
export async function seedIfEmpty(db: DB, opts: { mode?: SeedMode } = {}): Promise<boolean> {
  const mode = opts.mode ?? 'demo';
  return db.transaction(async (tx) => {
    if (await readSeedRecord(tx)) return false;
    await seedReference(tx);
    if (mode === 'demo') await seedDemo(tx);
    await writeSeedRecord(tx, mode);
    log.info('Database seeded', { component: 'db', seed: mode });
    return true;
  });
}
