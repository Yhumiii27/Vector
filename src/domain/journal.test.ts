import { describe, expect, it } from 'vitest';
import { csvCell, journalCsv, journalQuery, parseJournalFilters } from './journal';

describe('journal filters', () => {
  it('keeps the valid filters only, orders the period, bounds the page', () => {
    expect(parseJournalFilters({ q: '  Karim   B ', area: 'Shipments', from: '2026-11-30', to: '2026-11-01', page: '3' })).toEqual({
      q: 'Karim B', area: 'Shipments', from: '2026-11-01', to: '2026-11-30', personId: null, page: 3,
    });
    expect(parseJournalFilters({ area: 'Nope', from: '2026-13-45', page: '-1', person: 'x' })).toMatchObject({ area: null, from: null, page: 1, personId: null });
    expect(parseJournalFilters(new URLSearchParams('area=Sign-in'))).toMatchObject({ area: 'Sign-in' });
    expect(journalQuery({ q: 'a b', area: 'Shipments', page: 1 })).toBe('?q=a+b&area=Shipments');
    expect(journalQuery({})).toBe('');
  });
});

describe('journal CSV', () => {
  it('quotes, neutralises formulas, BOM and CRLF', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(null)).toBe('');
    const csv = journalCsv([{ occurredAt: new Date('2026-11-24T10:00:00Z'), actorName: 'Admin', actorRole: 'admin', area: 'Shipments', objectRef: 'Person a@b.c', change: 'activated', reason: null }]);
    expect(csv.startsWith('﻿date;acteur;role_acteur;domaine;objet;changement;motif\r\n')).toBe(true);
    expect(csv).toContain('2026-11-24T10:00:00.000Z;Admin;admin;Shipments;Person a@b.c;activated;\r\n');
  });
});
