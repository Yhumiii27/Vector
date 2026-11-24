import { describe, expect, it } from 'vitest';
import { SECTION_LABEL } from '@/config/screens';
import { makeT } from '@/i18n/translate';
import SAME from '@/i18n/same-in-french.json';
import { buildNav } from './nav-model';

describe('sidebar model', () => {
  it('a requester sees no administration, a manager sees it all', () => {
    const r = buildNav(['requester'], '/');
    expect(r.sections.map((s) => s.key)).toEqual(['steering', 'shipping']);
    expect(buildNav(['manager'], '/').sections.map((s) => s.key)).toEqual(['steering', 'shipping', 'network', 'analysis', 'admin']);
  });
  it('a shipment sheet keeps "Shipments" active', () => {
    const n = buildNav(['manager'], '/shipments/SH-2026-0001', { shipments: 4 });
    const e = n.sections.find((s) => s.key === 'shipping')!.entries.find((x) => x.id === 'shipments')!;
    expect(e).toMatchObject({ active: true, count: 4 });
  });
  it('every section title is translated into French', () => {
    const fr = makeT('fr');
    for (const label of Object.values(SECTION_LABEL)) expect(fr(label) !== label || SAME.strings.includes(label)).toBe(true);
  });
});
