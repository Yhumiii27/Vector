// The reference queries of Vector's publications run on the demonstration database, start with the R-158 v1 columns and never
// publish a value, a price or a cost (except pub_couts_expeditions, for Finance).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testDatabase, type TestDatabase } from '@/test/db';
import { PUBLICATIONS, R158_COLUMNS } from './definitions';

let t: TestDatabase;
beforeAll(async () => {
  t = await testDatabase();
});
afterAll(() => t.close());

describe('publications', () => {
  it('every reference query runs', async () => {
    for (const [name, q] of Object.entries(PUBLICATIONS)) {
      const r = await t.handle.pool.query(q);
      expect(r.rows.length, name).toBeGreaterThan(0);
    }
  });
  it('pub_expeditions keeps the R-158 v1 contract and its statuses', async () => {
    const r = await t.handle.pool.query(PUBLICATIONS.pub_expeditions);
    expect(r.fields.map((f) => f.name).slice(0, R158_COLUMNS.length)).toEqual([...R158_COLUMNS]);
    const statuses = new Set(r.rows.map((x) => x.statut));
    for (const s of statuses) expect(['draft', 'prepared', 'picked_up', 'in_transit', 'arrived', 'received', 'closed']).toContain(s);
    const held = r.rows.find((x) => x.vector_ref === 'SH-2026-0108');
    expect(held).toMatchObject({ statut: 'in_transit', statut_vector: 'on_hold' });
    expect(r.rows.find((x) => x.vector_ref === 'SH-2026-0101').expedition_ref).toBe('EXP-01');
  });
  it('no value, price or contact leaves through the non-financial views', async () => {
    for (const name of ['pub_expeditions', 'pub_colis', 'pub_demandes'] as const) {
      const r = await t.handle.pool.query(PUBLICATIONS[name]);
      for (const f of r.fields) expect(f.name, name).not.toMatch(/valeur|prix|montant|^cote$|facture|value|price|amount|email|contact/);
    }
  });
});
