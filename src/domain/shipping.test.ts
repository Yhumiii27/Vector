// Value tests of Vector's pure rules (docs/spec/01–04).
import { describe, expect, it } from 'vitest';
import { noticeDeadline, regimeOf, timeBar } from './claims';
import { complianceCleared, proposedChecks, waiverBlockers } from './compliance';
import { costSummary, costsReconciled, estimateFreight, rateOn, toEur } from './costs';
import { checklist, expectedDocuments, lcWarnings, missingBefore, type ChecklistFacts } from './documents';
import { currentEta, cutoffSoon, lateMilestones, lateness } from './eta';
import { INCOTERMS, groupSteps, insuredValue, seaOnlyMismatch } from './incoterms';
import { carrierScore, carrierStats, kpis, type KpiShipment } from './kpi';
import { chargeableWeight, fillRate, hsSummary, outOfGauge, packingTotals, prorata, volumeM3 } from './packing';
import { awardBlockers, rankQuotes } from './quotes';
import { blockers, forwardOf, keystoneStatusOf, targetOf, type ShipmentFacts } from './shipment-state';
import { FORMATS } from './vocab';

describe('packing', () => {
  const crate = { lengthCm: 200, widthCm: 120, heightCm: 100, grossKg: 850, netKg: 700 };
  it('volumes and totals', () => {
    expect(volumeM3(crate)).toBe(2.4);
    expect(packingTotals([crate, crate])).toEqual({ packages: 2, grossKg: 1700, netKg: 1400, volumeM3: 4.8 });
  });
  it('chargeable weight per mode', () => {
    const t = { grossKg: 300, volumeM3: 2.4 };
    expect(chargeableWeight(t, 'air', 'air_general').kg).toBe(400); // 2.4 m³ × 166.67
    expect(chargeableWeight(t, 'air', 'air_general').basis).toBe('volume');
    expect(chargeableWeight(t, 'express', 'parcel').kg).toBe(480);
    expect(chargeableWeight(t, 'sea', 'lcl').revenueTons).toBe(2.4);
    expect(chargeableWeight({ grossKg: 5000, volumeM3: 2 }, 'sea', 'lcl').revenueTons).toBe(5);
    expect(chargeableWeight(t, 'road', 'ltl').kg).toBe(799.2);
    expect(chargeableWeight(t, 'sea', 'fcl').indicative).toBe(true);
  });
  it('gauge, heavy lift and fill rate', () => {
    expect(outOfGauge(crate, 'c20')).toEqual({ oog: false, heavy: false });
    expect(outOfGauge({ ...crate, heightCm: 260 }, 'c40')).toEqual({ oog: true, heavy: false });
    expect(outOfGauge({ ...crate, heightCm: 260 }, 'c40hc').oog).toBe(false);
    expect(outOfGauge({ ...crate, widthCm: 300, grossKg: 12000 }, 'flat_rack')).toEqual({ oog: false, heavy: true });
    expect(outOfGauge(crate, 'deck').oog).toBe(false);
    const f = fillRate('c20', [crate, crate, crate]);
    expect(f.weight).toBeCloseTo(0.09, 2);
    expect(f.volume).toBeCloseTo(7.2 / 33.08, 2);
    expect(fillRate('c20', Array(40).fill(crate)).overweight).toBe(true);
  });
  it('HS summary flags missing codes and origins', () => {
    const s = hsSummary([
      { quantity: 2, unitValue: 100, currency: 'EUR', hsCode: '842489', originCountry: 'FR', netKg: 10 },
      { quantity: 1, unitValue: 50, currency: 'EUR', hsCode: '842489', originCountry: 'FR', netKg: 5 },
      { quantity: 1, unitValue: 10, currency: 'EUR', hsCode: null, originCountry: null, netKg: 1 },
    ]);
    expect(s.rows[0]).toMatchObject({ hsCode: '842489', value: 250, netKg: 15, lines: 2 });
    expect(s).toMatchObject({ missingHs: 1, missingOrigin: 1 });
  });
  it('prorata sums exactly', () => {
    const p = prorata(100, [1, 1, 1]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(p).toEqual([33.34, 33.33, 33.33]);
    expect(prorata(10, [0, 0])).toEqual([10, 0]);
  });
});

describe('Incoterms', () => {
  it('11 rules, seller steps', () => {
    expect(INCOTERMS).toHaveLength(11);
    expect(groupSteps('EXW')).toEqual(['export_packing']);
    expect(groupSteps('DAP')).toContain('on_carriage');
    expect(groupSteps('DAP')).not.toContain('import_clearance');
    expect(groupSteps('DDP')).toContain('duties');
    expect(groupSteps('FCA', 'buyer')).toContain('main_carriage');
    expect(seaOnlyMismatch('FOB', 'air')).toBe(true);
    expect(seaOnlyMismatch('FCA', 'air')).toBe(false);
    expect(insuredValue(1000)).toBe(1100);
  });
});

const baseFacts: ShipmentFacts = {
  state: 'draft', previousState: null, hasRoute: true, hasMode: true, hasIncoterm: true, packages: 2, packagesMeasured: true, packingValidated: true,
  awardedQuote: true, booking: true, international: true, complianceCleared: true, needsMrn: true, hasMrn: true, missingBeforePickup: 0,
  pickedUpOn: '2026-11-02', departedOn: '2026-11-04', arrivedOn: '2026-11-20', deliveredOn: '2026-11-22', podReference: true, openIncidents: 0, costsReconciled: true,
};

describe('shipment states', () => {
  it('walks the forward path when every condition holds', () => {
    let f = { ...baseFacts };
    for (const expected of ['planned', 'booked', 'picked_up', 'in_transit', 'arrived', 'delivered', 'closed']) {
      const t = forwardOf(f.state)!;
      expect(blockers(t, f)).toEqual([]);
      f = { ...f, state: targetOf(t, f) };
      expect(f.state).toBe(expected);
    }
    expect(forwardOf('closed')).toBeNull();
  });
  it('names what blocks', () => {
    expect(blockers('plan', { ...baseFacts, packages: 0, hasIncoterm: false })).toEqual(['The Incoterm is required', 'At least one package is required']);
    expect(blockers('book', { ...baseFacts, state: 'planned', complianceCleared: false })).toEqual(['The export compliance checklist is not cleared']);
    expect(blockers('book', { ...baseFacts, state: 'planned', complianceCleared: false, international: false })).toEqual([]);
    expect(blockers('depart', { ...baseFacts, state: 'picked_up', hasMrn: false })).toEqual(['The export declaration (MRN) is missing']);
    expect(blockers('arrive', { ...baseFacts, state: 'in_transit', arrivedOn: '2026-11-01' })).toEqual(['The arrival is before the departure']);
    expect(blockers('close', { ...baseFacts, state: 'delivered', costsReconciled: false })).toEqual(['Invoiced costs are not reconciled']);
    expect(blockers('close', { ...baseFacts, state: 'delivered', costsReconciled: false }, { force: true })).toEqual([]);
    expect(blockers('cancel', { ...baseFacts, state: 'in_transit' })).toHaveLength(1);
  });
  it('hold and resume return to the previous state', () => {
    expect(blockers('hold', { ...baseFacts, state: 'in_transit' })).toEqual([]);
    expect(targetOf('resume', { state: 'on_hold', previousState: 'in_transit' })).toBe('in_transit');
    expect(blockers('resume', { ...baseFacts, state: 'on_hold', previousState: null })).toHaveLength(1);
  });
  it('maps to the shared R-158 statuses', () => {
    expect(keystoneStatusOf('planned', null, false)).toBe('draft');
    expect(keystoneStatusOf('booked', null, false)).toBe('prepared');
    expect(keystoneStatusOf('delivered', null, false)).toBe('arrived');
    expect(keystoneStatusOf('delivered', null, true)).toBe('received');
    expect(keystoneStatusOf('on_hold', 'in_transit', false)).toBe('in_transit');
  });
});

const EU = new Set(['FR', 'DE', 'BE']);
const docFacts: ChecklistFacts = {
  mode: 'sea', freight: 'fcl', incoterm: 'CIF', originCountry: 'FR', destinationCountry: 'ZZ', euCountries: EU, procedure: 'export',
  dangerousGoods: false, dualUse: false, restrictedDestination: false, originDocument: 'certificate', payment: 'open_account', lcDocuments: [],
  insurance: 'policy', woodPackaging: true,
};

describe('document checklist', () => {
  it('sea export outside the EU', () => {
    const kinds = expectedDocuments(docFacts).map((d) => d.kind);
    expect(kinds).toEqual(expect.arrayContaining(['packing_list', 'proforma_invoice', 'commercial_invoice', 'shipping_instructions', 'bill_of_lading', 'vgm', 'export_declaration', 'certificate_of_origin', 'insurance_certificate', 'ispm15', 'pod']));
    expect(kinds).not.toContain('cmr');
    expect(kinds).not.toContain('air_waybill');
  });
  it('domestic road', () => {
    const kinds = expectedDocuments({ ...docFacts, mode: 'road', freight: 'ftl', destinationCountry: 'FR', procedure: 'domestic', originDocument: 'none', insurance: 'none', incoterm: 'DAP' }).map((d) => d.kind);
    expect(kinds).toEqual(['packing_list', 'marks', 'pod']);
  });
  it('dangerous goods, dual use, restricted destination and letter of credit', () => {
    const kinds = expectedDocuments({ ...docFacts, dangerousGoods: true, dualUse: true, restrictedDestination: true, payment: 'letter_of_credit', lcDocuments: ['eur1'] }).map((d) => d.kind);
    expect(kinds).toEqual(expect.arrayContaining(['dg_declaration', 'sds', 'dual_use_licence', 'end_use_certificate', 'lc_documents', 'eur1']));
  });
  it('matches the recorded documents and flags the late ones', () => {
    const lines = checklist(expectedDocuments(docFacts), [{ kind: 'packing_list', state: 'checked' }, { kind: 'ispm15', state: 'waived' }], 'booked');
    expect(lines.find((l) => l.kind === 'packing_list')!.done).toBe(true);
    expect(lines.find((l) => l.kind === 'proforma_invoice')!.late).toBe(true);
    expect(lines.find((l) => l.kind === 'bill_of_lading')!.late).toBe(false);
    expect(missingBefore(lines, 'before_pickup')).toBe(3); // proforma and shipping instructions (booking), marks
  });
  it('letter of credit dates', () => {
    expect(lcWarnings({ latestShipment: '2026-11-10', expiry: '2026-12-31' }, null, '2026-11-15', '2026-11-01')).toEqual(['Planned departure after the latest shipment date of the letter of credit']);
    expect(lcWarnings({ latestShipment: '2026-11-10', expiry: '2026-12-31' }, '2026-11-05', null, '2026-11-30')).toEqual(['The presentation period of the documents is over']);
    expect(lcWarnings({ latestShipment: null, expiry: '2026-11-01' }, null, null, '2026-11-02')).toEqual(['The letter of credit has expired']);
  });
});

describe('ETA and lateness', () => {
  it('current ETA', () => {
    expect(currentEta({ latestEta: null, bookedEta: null, etd: '2026-11-01', transitDays: 30 })).toBe('2026-12-01');
    expect(currentEta({ latestEta: '2026-12-05', bookedEta: '2026-12-01', etd: null, transitDays: null })).toBe('2026-12-05');
  });
  it('forecast and actual delay', () => {
    const l = lateness({ latestEta: '2026-12-05', bookedEta: '2026-12-01', etd: null, transitDays: null, ata: null, deliveredOn: null, neededOn: '2026-12-02' });
    expect(l).toMatchObject({ forecastDays: 3, atRisk: true, actualDays: null });
    expect(lateness({ latestEta: null, bookedEta: '2026-12-01', etd: null, transitDays: null, ata: null, deliveredOn: '2026-12-03', neededOn: null }).actualDays).toBe(2);
    expect(lateMilestones([{ code: 'pickup', plannedOn: '2026-11-01', actualOn: null }, { code: 'departed', plannedOn: '2026-12-01', actualOn: null }], '2026-11-24')).toHaveLength(1);
    expect(cutoffSoon(new Date('2026-11-25T10:00:00Z'), new Date('2026-11-24T10:00:00Z'))).toBe(true);
    expect(cutoffSoon(new Date('2026-11-23T10:00:00Z'), new Date('2026-11-24T10:00:00Z'))).toBe(false);
  });
});

describe('costs', () => {
  const rates = [{ currency: 'USD', perEur: 1.1, on: '2026-11-01' }, { currency: 'USD', perEur: 1.08, on: '2026-11-15' }];
  it('rates and conversion', () => {
    expect(rateOn(rates, 'USD', '2026-11-10')).toBe(1.1);
    expect(rateOn(rates, 'USD', '2026-11-20')).toBe(1.08);
    expect(rateOn(rates, 'ZAR', '2026-11-20')).toBeNull();
    expect(toEur(1100, 'USD', '2026-11-10', rates)).toBe(1000);
    expect(estimateFreight([{ mode: 'sea', zone: 'africa', eurPerKg: 0.45 }], 'sea', 'africa', 10_000)).toBe(4500);
  });
  it('summary and variance', () => {
    const s = costSummary([
      { category: 'freight', currency: 'EUR', estimated: 9000, quoted: 10_000, invoiced: 10_800, invoiceDate: '2026-11-20', reconciled: false },
      { category: 'insurance', currency: 'USD', estimated: null, quoted: 110, invoiced: 110, invoiceDate: '2026-11-10', reconciled: true },
      { category: 'other', currency: 'ZAR', estimated: null, quoted: 1, invoiced: null, invoiceDate: null, reconciled: false },
    ], rates, '2026-11-24');
    expect(s).toMatchObject({ quotedEur: 10_100, invoicedEur: 10_900, varianceEur: 800, toExplain: 1, unconverted: 1 });
    expect(s.variancePct).toBeCloseTo(0.079, 3);
    expect(costsReconciled([{ invoiced: 1, reconciled: true }, { invoiced: null, reconciled: false }])).toBe(true);
    expect(costsReconciled([{ invoiced: null, reconciled: false }])).toBe(false);
  });
});

describe('quotes', () => {
  const quotes = [
    { id: 'a', partnerName: 'A', amount: 12_000, currency: 'EUR', transitDays: 30, validUntil: '2026-12-31', state: 'received' as const },
    { id: 'b', partnerName: 'B', amount: 11_000, currency: 'EUR', transitDays: 40, validUntil: '2026-12-31', state: 'received' as const },
    { id: 'c', partnerName: 'C', amount: 9_000, currency: 'EUR', transitDays: 35, validUntil: '2026-11-01', state: 'received' as const },
  ];
  it('ranks by value with a delay cost', () => {
    const r = rankQuotes(quotes, [], '2026-11-24', 200);
    expect(r.map((q) => q.id)).toEqual(['c', 'a', 'b']);
    expect(r.find((q) => q.id === 'c')!.expired).toBe(true);
    expect(r.find((q) => q.id === 'c')!.cheapest).toBe(true);
  });
  it('award rules', () => {
    const r = rankQuotes(quotes, [], '2026-11-24');
    const a = r.find((q) => q.id === 'a')!;
    expect(awardBlockers(a, r, { isManager: false, reason: '', critical: false, estimateEur: 11_000 })).toEqual([
      'A reason is required when the cheapest quote is not chosen', 'Above the approval threshold, the shipping manager awards',
    ]);
    expect(awardBlockers(a, r, { isManager: true, reason: 'Faster', critical: false, estimateEur: 11_000 })).toEqual([]);
    expect(awardBlockers(r.find((q) => q.id === 'c')!, r, { isManager: true, reason: '', critical: false, estimateEur: 9_000 })).toEqual(['The quote has expired']);
  });
});

describe('compliance', () => {
  it('proposes the checks', () => {
    expect(proposedChecks({ international: true, destinationRisk: 'embargoed', transitRisks: [], dualUseLines: 0, dualUseLicence: false, dangerousGoodsLines: 0, dgDeclaration: false }))
      .toMatchObject({ destination: 'blocked', screening: 'pending', dual_use: 'na', end_use: 'na' });
    expect(proposedChecks({ international: true, destinationRisk: 'none', transitRisks: ['restricted'], dualUseLines: 1, dualUseLicence: false, dangerousGoodsLines: 1, dgDeclaration: true }))
      .toMatchObject({ destination: 'pending', dual_use: 'blocked', dangerous_goods: 'ok', end_use: 'pending' });
    expect(complianceCleared(['ok', 'na', 'waived'])).toBe(true);
    expect(complianceCleared(['ok', 'pending'])).toBe(false);
    expect(waiverBlockers('destination', 'embargoed', 'x', true)).toEqual(['An embargoed destination cannot be waived']);
    expect(waiverBlockers('screening', 'none', '', false)).toHaveLength(2);
  });
});

describe('claims', () => {
  it('deadlines by convention', () => {
    expect(regimeOf('road')).toBe('cmr');
    expect(noticeDeadline('cmr', 'damage', '2026-11-20')).toBe('2026-11-27');
    expect(noticeDeadline('montreal', 'damage', '2026-11-20')).toBe('2026-12-04');
    expect(noticeDeadline('hague_visby', 'damage', '2026-11-20')).toBe('2026-11-23');
    expect(timeBar('montreal', '2026-11-20')).toBe('2028-11-20');
  });
});

describe('indicators', () => {
  const row = (o: Partial<KpiShipment>): KpiShipment => ({
    state: 'closed', mode: 'sea', partnerId: 'p', requestedOn: '2026-10-01', neededOn: '2026-11-10', bookedEta: '2026-11-08', atd: '2026-10-10', ata: '2026-11-05',
    deliveredOn: '2026-11-08', chargeableKg: 1000, valueEur: 100_000, costEur: 5000, incidents: 0, shortageIncidents: 0, quotedEur: 5000, invoicedEur: 5200, ...o,
  });
  it('KPIs', () => {
    const k = kpis([row({}), row({ deliveredOn: '2026-11-20', incidents: 1 }), row({ state: 'in_transit', deliveredOn: null, ata: null, mode: 'air', chargeableKg: 1000 })]);
    expect(k).toMatchObject({ inProgress: 1, delivered: 2, otd: 0.5, otif: 0.5, medianRequestToDeparture: 9, airShareKg: 0.333 });
    expect(k.transitByMode.sea).toBe(26);
    expect(k.invoiceVariance).toBeCloseTo(0.04, 3);
  });
  it('carrier score from five shipments', () => {
    const s = carrierStats(Array(5).fill(row({})), [{ answeredHours: 24, awarded: true }, { answeredHours: null, awarded: false }]);
    expect(s).toMatchObject({ shipments: 5, punctuality: 1, answerRate: 0.5, awardRate: 1 });
    expect(carrierScore(s)).toBeGreaterThan(70);
    expect(carrierScore({ ...s, shipments: 4 })).toBeNull();
  });
});

describe('formats', () => {
  it('references and codes', () => {
    expect(FORMATS.shipmentRef.test('SH-2026-0001')).toBe(true);
    expect(FORMATS.mrn.test('26FR000000000012345')).toBe(false);
    expect(FORMATS.mrn.test('26FRA1234567890AB1')).toBe(true);
    expect(FORMATS.container.test('MSCU1234567')).toBe(true);
    expect(FORMATS.hsCode.test('84248900')).toBe(true);
  });
});
