import 'server-only';
// Reads of the journal (lot A): the append-only audit trail, filtered by text, area and period, newest first. The
// shipping manager and the administrator only (the pages and the export check the role). Days are Paris days.
import { and, count, desc, eq, gte, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import { JOURNAL_EXPORT_MAX, JOURNAL_PAGE_SIZE, type JournalFilters, type JournalLine } from '@/domain/journal';
import { getDb } from '@/server/db/client';
import { auditEntries } from '@/server/db/schema';

export interface JournalRow extends JournalLine {
  id: string;
}

/** A Paris day's first instant, as a timestamp the database compares. */
const parisDay = (day: string) => sql`(${day}::date)::timestamp at time zone 'Europe/Paris'`;
const likeText = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function where(f: JournalFilters): SQL | undefined {
  const c: SQL[] = [];
  if (f.area) c.push(eq(auditEntries.area, f.area));
  if (f.from) c.push(gte(auditEntries.occurredAt, parisDay(f.from)));
  if (f.to) c.push(lt(auditEntries.occurredAt, sql`${parisDay(f.to)} + interval '1 day'`));
  if (f.q) {
    const q = likeText(f.q);
    c.push(or(ilike(auditEntries.objectRef, q), ilike(auditEntries.actorName, q), ilike(auditEntries.change, q), ilike(auditEntries.reason, q))!);
  }
  return c.length ? and(...c) : undefined;
}

async function select(f: JournalFilters, limit: number, offset: number): Promise<JournalRow[]> {
  const db = await getDb();
  return db
    .select({
      id: auditEntries.id, occurredAt: auditEntries.occurredAt, actorName: auditEntries.actorName, actorRole: auditEntries.actorRole, area: auditEntries.area,
      objectRef: auditEntries.objectRef, change: auditEntries.change, reason: auditEntries.reason,
    })
    .from(auditEntries)
    .where(where(f))
    .orderBy(desc(auditEntries.occurredAt), desc(auditEntries.id))
    .limit(limit)
    .offset(offset);
}

/** One page of the journal and the number of entries the filters keep. */
export async function journalPage(f: JournalFilters): Promise<{ rows: JournalRow[]; total: number }> {
  const db = await getDb();
  const [rows, [{ n }]] = await Promise.all([
    select(f, JOURNAL_PAGE_SIZE, (f.page - 1) * JOURNAL_PAGE_SIZE),
    db.select({ n: count() }).from(auditEntries).where(where(f)),
  ]);
  return { rows, total: Number(n) };
}

/** The entries of an export (at most JOURNAL_EXPORT_MAX, newest first), and whether the filters keep more. */
export async function journalExport(f: JournalFilters): Promise<{ rows: JournalRow[]; truncated: boolean }> {
  const rows = await select(f, JOURNAL_EXPORT_MAX + 1, 0);
  return { rows: rows.slice(0, JOURNAL_EXPORT_MAX), truncated: rows.length > JOURNAL_EXPORT_MAX };
}
