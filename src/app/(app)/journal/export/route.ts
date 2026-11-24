// GET /journal/export — the journal as CSV (lot A), with the filters of the journal page (?q, area, from, to, person), at most
// JOURNAL_EXPORT_MAX entries, newest first. The IT administrator and the reader only (404 otherwise, as the page); the export
// itself is journalled (who exported what). Never cached.
import { can } from '@/domain/rights';
import { journalCsv, journalQuery, parseJournalFilters } from '@/domain/journal';
import { journalExport } from '@/server/dal/journal';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { getViewer } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const viewer = await getViewer();
  if (!can(viewer.roles, 'journal')) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const f = parseJournalFilters(new URL(request.url).searchParams);
  const { rows, truncated } = await journalExport(f);
  await writeAudit(await getDb(), {
    actorName: viewer.name, actorUserId: viewer.userId, actorRole: viewer.role, objectRef: 'Journal', area: 'Administration',
    change: `journal exported: ${rows.length} entries${truncated ? ' (truncated)' : ''}${journalQuery({ ...f, page: 1 }) ? ` · ${journalQuery({ ...f, page: 1 }).slice(1)}` : ''}`,
  });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(journalCsv(rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vector-journal-${day}.csv"`,
      'Cache-Control': 'no-store',
      ...(truncated ? { 'X-Vector-Truncated': 'true' } : {}),
    },
  });
}
