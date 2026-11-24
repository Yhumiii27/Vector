import 'server-only';
// Reads of Vector's shipping data. The volume is small (hundreds of shipments a year), so every page loads the shipments it
// may see with their children in a fixed number of queries and the pure rules of src/domain compute the rest (totals,
// chargeable weight, ETA, lateness, checklist, costs, KPIs) — computed on every read, never stored.
// Visibility (docs/spec/06 § 1, question U-3): a viewer without the right `see_all` (a requester) sees only the shipments that
// carry one of their own requests; anything else is a 404 (`shipmentByRef`).
import { inArray } from 'drizzle-orm';
import { cache } from 'react';
import { checklist, expectedDocuments, type ChecklistLine } from '@/domain/documents';
import { complianceCleared } from '@/domain/compliance';
import { costSummary, costsReconciled, rateOn, type CostSummary, type Rate } from '@/domain/costs';
import { lateness, type Lateness } from '@/domain/eta';
import { seaOnlyMismatch } from '@/domain/incoterms';
import { chargeableWeight, hsSummary, outOfGauge, packingTotals, valueByCurrency, volumeM3, type Chargeable, type PackingTotals } from '@/domain/packing';
import { can } from '@/domain/rights';
import { blockers, forwardOf, type ShipmentFacts, type Transition } from '@/domain/shipment-state';
import type { CountryRisk, DocumentKind, LoadType, ShipmentState } from '@/domain/vocab';
import { getDb } from '@/server/db/client';
import {
  bookings, complianceChecks, costLines, countries, customsDeclarations, exchangeRates, incidents, loads, milestones, packageLines, packages, partners,
  quotes, rfqInvitations, rfqs, shipmentAllocations, shipmentDocuments, shipmentRequests, shipments, sites,
} from '@/server/db/schema';
import type { Viewer } from '@/server/viewer';

export type ShipmentRow = typeof shipments.$inferSelect;
export type RequestRow = typeof shipmentRequests.$inferSelect;
export type PackageRow = typeof packages.$inferSelect & { lines: (typeof packageLines.$inferSelect)[]; volumeM3: number; oog: boolean; heavy: boolean };
export type PartnerRow = typeof partners.$inferSelect;
export type SiteRow = typeof sites.$inferSelect;
export type CountryRow = typeof countries.$inferSelect;

export interface ShipmentView {
  s: ShipmentRow;
  requests: RequestRow[];
  loads: (typeof loads.$inferSelect)[];
  packages: PackageRow[];
  rfqs: ((typeof rfqs.$inferSelect) & { quotes: ((typeof quotes.$inferSelect) & { partnerName: string })[]; invited: { partnerId: string; partnerName: string; answeredAt: Date | null }[] })[];
  booking: (typeof bookings.$inferSelect & { partnerName: string }) | null;
  milestones: (typeof milestones.$inferSelect)[];
  customs: (typeof customsDeclarations.$inferSelect) | null;
  compliance: (typeof complianceChecks.$inferSelect)[];
  documents: (typeof shipmentDocuments.$inferSelect)[];
  incidents: (typeof incidents.$inferSelect & { partnerName: string | null })[];
  costs: (typeof costLines.$inferSelect & { partnerName: string | null })[];
  from: SiteRow | null;
  to: SiteRow | null;
  // Computed
  totals: PackingTotals;
  chargeable: Chargeable;
  values: Record<string, number>;
  valueEur: number | null;
  hs: ReturnType<typeof hsSummary>;
  dangerousGoods: boolean;
  dualUse: boolean;
  international: boolean;
  late: Lateness;
  neededOn: string | null;
  checklist: ChecklistLine[];
  missingDocs: number;
  lateDocs: number;
  openIncidents: number;
  cost: CostSummary;
  awarded: ((typeof quotes.$inferSelect) & { partnerName: string }) | null;
  carrierName: string | null;
  next: Transition | null;
  nextBlockers: string[];
  facts: ShipmentFacts;
  incotermWarning: boolean;
  complianceOk: boolean;
}

export interface World {
  shipments: ShipmentView[];
  requests: RequestRow[];
  partners: PartnerRow[];
  sites: SiteRow[];
  countries: CountryRow[];
  rates: Rate[];
}

const group = <T, K>(rows: readonly T[], key: (r: T) => K) => {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
};

/** Every shipment and request the viewer may see, with their children (memoised per request). */
export const loadWorld = cache(async (viewer: Viewer, today: string): Promise<World> => {
  const db = await getDb();
  const [allShipments, allRequests, allAlloc, partnerRows, siteRows, countryRows, rateRows] = await Promise.all([
    db.select().from(shipments),
    db.select().from(shipmentRequests),
    db.select().from(shipmentAllocations),
    db.select().from(partners),
    db.select().from(sites),
    db.select().from(countries),
    db.select().from(exchangeRates),
  ]);
  const seeAll = can(viewer.roles, 'see_all');
  const myRequests = new Set(allRequests.filter((r) => seeAll || r.requestedById === viewer.userId).map((r) => r.id));
  const allocBy = group(allAlloc, (a) => a.shipmentId);
  const visible = allShipments.filter((s) => seeAll || (allocBy.get(s.id) ?? []).some((a) => myRequests.has(a.requestId)));
  const ids = visible.map((s) => s.id);
  const pick = <T,>(p: Promise<T[]>) => (ids.length ? p : Promise.resolve([] as T[]));
  const [loadRows, pkgRows, rfqRows, bookingRows, msRows, customsRows, compRows, docRows, incRows, costRows] = await Promise.all([
    pick(db.select().from(loads).where(inArray(loads.shipmentId, ids))),
    pick(db.select().from(packages).where(inArray(packages.shipmentId, ids))),
    pick(db.select().from(rfqs).where(inArray(rfqs.shipmentId, ids))),
    pick(db.select().from(bookings).where(inArray(bookings.shipmentId, ids))),
    pick(db.select().from(milestones).where(inArray(milestones.shipmentId, ids))),
    pick(db.select().from(customsDeclarations).where(inArray(customsDeclarations.shipmentId, ids))),
    pick(db.select().from(complianceChecks).where(inArray(complianceChecks.shipmentId, ids))),
    pick(db.select().from(shipmentDocuments).where(inArray(shipmentDocuments.shipmentId, ids))),
    pick(db.select().from(incidents).where(inArray(incidents.shipmentId, ids))),
    pick(db.select().from(costLines).where(inArray(costLines.shipmentId, ids))),
  ]);
  const pkgIds = pkgRows.map((p) => p.id);
  const rfqIds = rfqRows.map((r) => r.id);
  const [lineRows, quoteRows, invRows] = await Promise.all([
    pkgIds.length ? db.select().from(packageLines).where(inArray(packageLines.packageId, pkgIds)) : Promise.resolve([]),
    rfqIds.length ? db.select().from(quotes).where(inArray(quotes.rfqId, rfqIds)) : Promise.resolve([]),
    rfqIds.length ? db.select().from(rfqInvitations).where(inArray(rfqInvitations.rfqId, rfqIds)) : Promise.resolve([]),
  ]);
  const partnerName = new Map(partnerRows.map((p) => [p.id, p.name]));
  const siteBy = new Map(siteRows.map((s) => [s.code, s]));
  const countryBy = new Map(countryRows.map((c) => [c.code, c]));
  const eu = new Set(countryRows.filter((c) => c.eu).map((c) => c.code));
  const rates: Rate[] = rateRows.map((r) => ({ currency: r.currency, perEur: r.perEur, on: r.on }));
  const reqBy = new Map(allRequests.map((r) => [r.id, r]));
  const loadsBy = group(loadRows, (r) => r.shipmentId);
  const linesBy = group(lineRows, (r) => r.packageId);
  const pkgBy = group(pkgRows, (r) => r.shipmentId);
  const rfqBy = group(rfqRows, (r) => r.shipmentId);
  const quotesBy = group(quoteRows, (r) => r.rfqId);
  const invBy = group(invRows, (r) => r.rfqId);
  const msBy = group(msRows, (r) => r.shipmentId);
  const compBy = group(compRows, (r) => r.shipmentId);
  const docBy = group(docRows, (r) => r.shipmentId);
  const incBy = group(incRows, (r) => r.shipmentId);
  const costBy = group(costRows, (r) => r.shipmentId);
  const bookingBy = new Map(bookingRows.map((b) => [b.shipmentId, b]));
  const customsBy = new Map(customsRows.map((c) => [c.shipmentId, c]));

  const views = visible.map((s): ShipmentView => {
    const ls = (loadsBy.get(s.id) ?? []).sort((a, b) => a.number - b.number);
    const loadType = new Map(ls.map((l) => [l.id, l.type as LoadType]));
    const pk = (pkgBy.get(s.id) ?? []).sort((a, b) => a.number - b.number).map((p): PackageRow => {
      const g = outOfGauge({ lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm, grossKg: p.grossKg, netKg: p.netKg }, p.loadId ? loadType.get(p.loadId) ?? null : null);
      return { ...p, lines: linesBy.get(p.id) ?? [], volumeM3: volumeM3(p), oog: g.oog, heavy: g.heavy };
    });
    const lines = pk.flatMap((p) => p.lines);
    const totals = packingTotals(pk.map((p) => ({ lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm, grossKg: p.grossKg, netKg: p.netKg })));
    const chargeable = chargeableWeight(totals, s.mode as never, s.freightType as never);
    const values = valueByCurrency(lines.map((l) => ({ quantity: l.quantity, unitValue: l.unitValue, currency: l.currency, hsCode: l.hsCode, originCountry: l.originCountry, netKg: l.netKg })));
    let valueEur: number | null = 0;
    for (const [cur, v] of Object.entries(values)) {
      const r = rateOn(rates, cur, today);
      valueEur = valueEur == null || r == null ? null : Math.round((valueEur + v / r) * 100) / 100;
    }
    const hs = hsSummary(lines.map((l) => ({ quantity: l.quantity, unitValue: l.unitValue, currency: l.currency, hsCode: l.hsCode, originCountry: l.originCountry, netKg: l.netKg })));
    const reqs = (allocBy.get(s.id) ?? []).map((a) => reqBy.get(a.requestId)!).filter(Boolean);
    const neededOn = reqs.map((r) => r.neededOn).sort()[0] ?? null;
    const rf = (rfqBy.get(s.id) ?? []).map((r) => ({
      ...r,
      quotes: (quotesBy.get(r.id) ?? []).map((q) => ({ ...q, partnerName: partnerName.get(q.partnerId) ?? '—' })).sort((a, b) => a.amount - b.amount),
      invited: (invBy.get(r.id) ?? []).map((i) => ({ partnerId: i.partnerId, partnerName: partnerName.get(i.partnerId) ?? '—', answeredAt: i.answeredAt })),
    })).sort((a, b) => a.ref.localeCompare(b.ref));
    const awarded = rf.flatMap((r) => r.quotes).find((q) => q.state === 'awarded') ?? null;
    const b = bookingBy.get(s.id);
    const booking = b ? { ...b, partnerName: partnerName.get(b.partnerId) ?? '—' } : null;
    const ms = msBy.get(s.id) ?? [];
    const late = lateness({ latestEta: s.latestEta, bookedEta: booking?.eta ?? null, etd: s.etd, transitDays: awarded?.transitDays ?? null, ata: s.ata, deliveredOn: s.deliveredOn, neededOn: s.eta ? neededOn : neededOn });
    const fromC = countryBy.get(s.fromCountry);
    const toC = countryBy.get(s.toCountry);
    const international = s.fromCountry !== s.toCountry;
    const dangerousGoods = lines.some((l) => l.unNumber);
    const dualUse = lines.some((l) => l.dualUseCode);
    const customs = customsBy.get(s.id) ?? null;
    const docs = docBy.get(s.id) ?? [];
    const expected = expectedDocuments({
      mode: s.mode as never, freight: s.freightType as never, incoterm: s.incoterm, originCountry: s.fromCountry, destinationCountry: s.toCountry, euCountries: eu,
      procedure: (customs?.procedure as never) ?? null, dangerousGoods, dualUse, restrictedDestination: toC?.risk === 'restricted',
      originDocument: s.fromCountry === 'FR' || fromC?.eu ? ((toC?.originDocument as never) ?? 'none') : 'none', payment: s.payment as never,
      lcDocuments: s.lcDocuments as DocumentKind[], insurance: s.insurance as never, woodPackaging: pk.some((p) => p.type === 'crate' || p.type === 'pallet' || p.type === 'skid'),
    });
    const list = checklist(expected, docs.map((x) => ({ kind: x.kind as DocumentKind, state: x.state as never })), s.state as ShipmentState);
    const comp = compBy.get(s.id) ?? [];
    const complianceOk = complianceCleared(comp.map((c) => c.state as never));
    const inc = (incBy.get(s.id) ?? []).map((i) => ({ ...i, partnerName: i.partnerId ? partnerName.get(i.partnerId) ?? null : null }));
    const openIncidents = inc.filter((i) => i.state === 'open' || i.state === 'claimed').length;
    const costs = (costBy.get(s.id) ?? []).map((c) => ({ ...c, partnerName: c.partnerId ? partnerName.get(c.partnerId) ?? null : null }));
    const cost = costSummary(costs.map((c) => ({ category: c.category as never, currency: c.currency, estimated: c.estimated, quoted: c.quoted, invoiced: c.invoiced, invoiceDate: c.invoiceDate, reconciled: c.reconciled })), rates, today);
    const leavesEu = eu.has(s.fromCountry) && !eu.has(s.toCountry);
    const facts: ShipmentFacts = {
      state: s.state as ShipmentState, previousState: (s.previousState as ShipmentState) ?? null,
      hasRoute: !!(s.fromSite || s.fromAddress) && !!(s.toSite || s.toAddress), hasMode: !!s.mode, hasIncoterm: !!s.incoterm,
      packages: pk.length, packagesMeasured: pk.every((p) => p.grossKg > 0 && p.lengthCm > 0), packingValidated: !!s.packingValidatedAt,
      awardedQuote: !!awarded, booking: !!booking, international, complianceCleared: complianceOk,
      needsMrn: leavesEu && (customs?.procedure ?? 'export') !== 'domestic' && customs?.procedure !== 'intra_eu', hasMrn: !!customs?.mrn,
      missingBeforePickup: list.filter((l) => !l.done && (l.due === 'before_booking' || l.due === 'before_pickup')).length,
      pickedUpOn: s.pickedUpOn, departedOn: s.atd, arrivedOn: s.ata, deliveredOn: s.deliveredOn, podReference: !!s.podCodexRef,
      openIncidents, costsReconciled: costsReconciled(costs),
    };
    const next = forwardOf(s.state as ShipmentState);
    return {
      s, requests: reqs, loads: ls, packages: pk, rfqs: rf, booking, milestones: ms, customs, compliance: comp, documents: docs, incidents: inc, costs,
      from: s.fromSite ? siteBy.get(s.fromSite) ?? null : null, to: s.toSite ? siteBy.get(s.toSite) ?? null : null,
      totals, chargeable, values, valueEur, hs, dangerousGoods, dualUse, international, late, neededOn, checklist: list,
      missingDocs: list.filter((l) => !l.done).length, lateDocs: list.filter((l) => l.late).length, openIncidents, cost, awarded,
      carrierName: booking?.partnerName ?? awarded?.partnerName ?? null, next, nextBlockers: next ? blockers(next, facts) : [], facts,
      incotermWarning: seaOnlyMismatch(s.incoterm, s.mode), complianceOk,
    };
  }).sort((a, b) => b.s.ref.localeCompare(a.s.ref));

  return {
    shipments: views,
    requests: allRequests.filter((r) => myRequests.has(r.id)).sort((a, b) => b.ref.localeCompare(a.ref)),
    partners: partnerRows.sort((a, b) => a.name.localeCompare(b.name)),
    sites: siteRows.sort((a, b) => a.name.localeCompare(b.name)),
    countries: countryRows.sort((a, b) => a.name.localeCompare(b.name)),
    rates,
  };
});

/** The risk of a country (none when unknown). */
export const riskOf = (w: World, code: string): CountryRisk => (w.countries.find((c) => c.code === code)?.risk as CountryRisk) ?? 'none';

/** A shipment the viewer may see, or null (the page answers 404). */
export async function shipmentByRef(viewer: Viewer, today: string, ref: string): Promise<{ world: World; view: ShipmentView } | null> {
  const world = await loadWorld(viewer, today);
  const view = world.shipments.find((v) => v.s.ref === ref);
  return view ? { world, view } : null;
}
