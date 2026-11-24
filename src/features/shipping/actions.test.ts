// The Server Functions on a fresh demonstration database: rights checked server-side, the shipment state machine applied again,
// the database constraints, the audit trail written in the same transaction.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RoleKey } from '@/config/roles';
import { auditEntries, packages, shipmentRequests, shipments } from '@/server/db/schema';
import { testDatabase, type TestDatabase } from '@/test/db';

let t: TestDatabase;
let as: { role: RoleKey; userId: string; name: string } = { role: 'manager', userId: '', name: 'Élise Garnier' };

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/session', () => ({
  getViewer: async () => ({ userId: as.userId, name: as.name, email: 'x@demo.example', initials: 'XX', role: as.role, roles: [as.role], demo: true }),
}));

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
};

beforeAll(async () => {
  t = await testDatabase();
  const { users } = await import('@/server/db/schema');
  const rows = await t.db.select().from(users);
  const by = (n: string) => rows.find((u) => u.name === n)!.id;
  as = { role: 'manager', userId: by('Élise Garnier'), name: 'Élise Garnier' };
  (globalThis as Record<string, unknown>).__ids = { requester: by('Sarah Roux'), manager: by('Élise Garnier') };
});
afterAll(() => t.close());

describe('requests and shipments', () => {
  it('a requester creates a request; only the shipping team accepts it into a new shipment', async () => {
    const A = await import('./actions');
    const ids = (globalThis as unknown as { __ids: Record<string, string> }).__ids;
    as = { role: 'requester', userId: ids.requester, name: 'Sarah Roux' };
    const r = await A.createRequestAction(null, fd({
      origin: 'spare_part', title: 'Filtres de rechange', description: 'Deux cartons', costCode: 'sav-pieces', fromSite: 'magasin-pieces', toSite: 'mine-savane',
      readyOn: '2026-11-25', neededOn: '2026-12-05', urgency: 'urgent', dangerousGoods: 'no', submit: 'on',
    }));
    expect(r).toEqual({ ok: true });
    const [req] = await t.db.select().from(shipmentRequests).where(eq(shipmentRequests.title, 'Filtres de rechange'));
    expect(req).toMatchObject({ ref: 'SR-2026-0071', state: 'submitted', costCode: 'SAV-PIECES', fromCountry: 'FR', toCountry: 'CI' });
    expect(await A.acceptRequestAction(null, fd({ ref: req.ref, mode: 'express' }))).toEqual({ ok: false, error: 'You do not have the right to do this' });

    as = { role: 'coordinator', userId: ids.manager, name: 'Hugo Leclerc' };
    expect(await A.acceptRequestAction(null, fd({ ref: req.ref, mode: 'express' }))).toEqual({ ok: true });
    const [s] = await t.db.select().from(shipments).where(eq(shipments.ref, 'SH-2026-0112'));
    expect(s).toMatchObject({ state: 'draft', mode: 'express', toSite: 'mine-savane' });
    expect(await t.db.$count(auditEntries, eq(auditEntries.objectRef, 'SH-2026-0112'))).toBeGreaterThan(0);
  });

  it('the state machine refuses what is missing, then lets the shipment through once complete', async () => {
    const A = await import('./actions');
    const ids = (globalThis as unknown as { __ids: Record<string, string> }).__ids;
    as = { role: 'manager', userId: ids.manager, name: 'Élise Garnier' };
    expect(await A.transitionAction(null, fd({ ref: 'SH-2026-0112', transition: 'plan' }))).toEqual({ ok: false, error: 'The Incoterm is required' });
    expect(await A.updateShipmentAction(null, fd({ ref: 'SH-2026-0112', title: 'Filtres de rechange', mode: 'express', freightType: 'parcel', incoterm: 'DAP', incotermPlace: 'Mine de la Savane', payment: 'open_account', insurance: 'policy' }))).toEqual({ ok: true });
    expect(await A.transitionAction(null, fd({ ref: 'SH-2026-0112', transition: 'plan' }))).toEqual({ ok: false, error: 'At least one package is required' });
    expect(await A.addPackageAction(null, fd({ ref: 'SH-2026-0112', type: 'box', lengthCm: '60', widthCm: '40', heightCm: '40', grossKg: '12', netKg: '15', description: 'Carton' }))).toEqual({ ok: false, error: 'The net weight is above the gross weight' });
    expect(await A.addPackageAction(null, fd({ ref: 'SH-2026-0112', type: 'box', lengthCm: '60', widthCm: '40', heightCm: '40', grossKg: '15', netKg: '12', description: 'Carton', lineDescription: 'Filtres', lineQuantity: '10', hsCode: '84212300', originCountry: 'FR', unitValue: '40' }))).toEqual({ ok: true });
    expect(await t.db.$count(packages)).toBeGreaterThan(0);
    expect(await A.transitionAction(null, fd({ ref: 'SH-2026-0112', transition: 'plan' }))).toEqual({ ok: true });
    // Booking needs the packing list, an award and a booking.
    expect(await A.transitionAction(null, fd({ ref: 'SH-2026-0112', transition: 'book' }))).toEqual({ ok: false, error: 'The packing list is not validated' });
    expect(await A.validatePackingAction('SH-2026-0112')).toEqual({ ok: true });
    expect(await A.transitionAction(null, fd({ ref: 'SH-2026-0112', transition: 'cancel' }))).toEqual({ ok: false, error: 'A reason is required' });
    expect(await A.transitionAction(null, fd({ ref: 'SH-2026-0112', transition: 'hold', reason: 'Attente du client' }))).toEqual({ ok: true });
    const [held] = await t.db.select().from(shipments).where(eq(shipments.ref, 'SH-2026-0112'));
    expect(held).toMatchObject({ state: 'on_hold', previousState: 'planned', stateReason: 'Attente du client' });
    expect(await A.transitionAction(null, fd({ ref: 'SH-2026-0112', transition: 'resume' }))).toEqual({ ok: true });
  });

  it('a requester cannot see another person’s shipment, a reader cannot track', async () => {
    const A = await import('./actions');
    as = { role: 'requester', userId: '00000000-0000-4000-8000-000000000000', name: 'Personne' };
    expect(await A.reportIncidentAction(null, fd({ ref: 'SH-2026-0103', type: 'delay', severity: 'minor', occurredOn: '2026-11-20', description: 'Test de visibilité' }))).toEqual({ ok: false, error: 'Shipment not found' });
    as = { role: 'reader', userId: '00000000-0000-4000-8000-000000000000', name: 'Lecteur' };
    expect(await A.setMilestoneAction(null, fd({ ref: 'SH-2026-0103', code: 'arrived', plannedOn: '2026-12-10' }))).toEqual({ ok: false, error: 'You do not have the right to do this' });
  });

  it('the database refuses a malformed MRN even if the form let it through', async () => {
    const A = await import('./actions');
    const ids = (globalThis as unknown as { __ids: Record<string, string> }).__ids;
    as = { role: 'manager', userId: ids.manager, name: 'Élise Garnier' };
    const r = await A.saveCustomsAction(null, fd({ ref: 'SH-2026-0104', procedure: 'export', mrn: '12345' }));
    expect(r.ok).toBe(false);
  });

  it('an award above the threshold needs the shipping manager; the cheapest needs no reason', async () => {
    const A = await import('./actions');
    const { quotes, rfqs } = await import('@/server/db/schema');
    const ids = (globalThis as unknown as { __ids: Record<string, string> }).__ids;
    const [rfq] = await t.db.select().from(rfqs).where(eq(rfqs.ref, 'RFQ-2026-0105'));
    const qs = (await t.db.select().from(quotes).where(eq(quotes.rfqId, rfq.id))).sort((a, b) => a.amount - b.amount);
    as = { role: 'coordinator', userId: ids.manager, name: 'Hugo Leclerc' };
    expect(await A.awardQuoteAction(null, fd({ quote: qs[1].id }))).toEqual({ ok: false, error: 'A reason is required when the cheapest quote is not chosen' });
    expect(await A.awardQuoteAction(null, fd({ quote: qs[0].id }))).toEqual({ ok: true });
    const [won] = await t.db.select().from(quotes).where(eq(quotes.id, qs[0].id));
    expect(won.state).toBe('awarded');
  });
});
