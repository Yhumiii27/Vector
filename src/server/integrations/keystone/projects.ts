import 'server-only';
// Keystone connector (read-only, docs/spec/05 § 2): the projects of keystone.pub_projets, read once Matrix grants vector_app the
// link (request DM-2). Until then — or when the view cannot be read — the source is "unavailable": a state shown on the
// screen, never a page error (Norma § 5), and the project code is checked by its format only.
import { sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';

export type SourceState<T> = { state: 'available'; rows: T[] } | { state: 'unavailable'; reason: string };

export async function readKeystoneProjects(): Promise<SourceState<{ code: string; nom: string }>> {
  try {
    const db = await getDb();
    const r = await db.execute(sql`select code, nom from keystone.pub_projets order by code limit 2000`);
    return { state: 'available', rows: r.rows as { code: string; nom: string }[] };
  } catch (e) {
    return { state: 'unavailable', reason: e instanceof Error ? e.message.slice(0, 120) : 'unreadable' };
  }
}
