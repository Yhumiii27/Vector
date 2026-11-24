// The journal (lot A): the append-only audit trail, read and exported by the shipping manager and the administrator. Pure rules:
// the filters of the page (from the address), and the CSV of an export (one line per entry, `;` separated, as the IT
// department opens it in a spreadsheet; a cell that a spreadsheet would run as a formula is neutralised).

/** The areas the journal is written in (src/server writes them as EN source strings). */
export const JOURNAL_AREAS = ['Sign-in', 'Requests', 'Shipments', 'Transport', 'Customs', 'Documents', 'Incidents', 'Costs', 'Partners', 'Administration', 'Connectors'] as const;

export const JOURNAL_PAGE_SIZE = 100;
/** At most this many lines in one export (a period or a filter narrows a larger one). */
export const JOURNAL_EXPORT_MAX = 50_000;

export interface JournalFilters {
  /** Text searched in the object, the actor, the change and the reason. */
  q: string | null;
  area: string | null;
  /** First and last day (YYYY-MM-DD, Paris time), inclusive. */
  from: string | null;
  to: string | null;
  personId: string | null;
  page: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined | null) => (Array.isArray(v) ? v[0] : v) ?? null;
const validDay = (v: string | null) => (v && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null);

/** The filters an address asks for; anything malformed is ignored. */
export function parseJournalFilters(sp: Record<string, string | string[] | undefined> | URLSearchParams): JournalFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : one(sp[k]));
  const q = (get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 100) || null;
  const area = get('area');
  const person = get('person');
  const page = Number(get('page') ?? '1');
  let from = validDay(get('from'));
  let to = validDay(get('to'));
  if (from && to && from > to) [from, to] = [to, from];
  return {
    q, area: area && (JOURNAL_AREAS as readonly string[]).includes(area) ? area : null, from, to,
    personId: person && UUID.test(person) ? person : null, page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** The address of the journal (or its export) with these filters; `page` 1 and empty filters are left out. */
export function journalQuery(f: Partial<JournalFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.area) p.set('area', f.area);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.personId) p.set('person', f.personId);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** One CSV cell: quoted when needed, a leading = + - @ (a formula in a spreadsheet) prefixed with an apostrophe. */
export function csvCell(v: string | null | undefined): string {
  let s = (v ?? '').replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface JournalLine {
  occurredAt: Date;
  actorName: string;
  actorRole: string | null;
  area: string;
  objectRef: string;
  change: string;
  reason: string | null;
}

export const JOURNAL_CSV_HEADER = ['date', 'acteur', 'role_acteur', 'domaine', 'objet', 'changement', 'motif'] as const;

/** The CSV of an export (UTF-8 with a byte order mark so a spreadsheet reads the accents; instants in ISO 8601, UTC). */
export function journalCsv(lines: readonly JournalLine[]): string {
  const rows = lines.map((l) => [l.occurredAt.toISOString(), l.actorName, l.actorRole, l.area, l.objectRef, l.change, l.reason].map(csvCell).join(';'));
  return `﻿${[JOURNAL_CSV_HEADER.join(';'), ...rows].join('\r\n')}\r\n`;
}
