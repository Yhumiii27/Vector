// Small adapters between the world loader and the pages (pure).
import type { KpiShipment } from '@/domain/kpi';
import type { ShipmentView, World } from '@/server/dal/world';

export const siteOptions = (w: World) => w.sites.map((s) => ({ value: s.code, label: `${s.name} (${s.country})` }));

export const partnerOptions = (w: World, kinds?: readonly string[]) =>
  w.partners.filter((p) => p.state === 'active' && (!kinds || kinds.includes(p.kind))).map((p) => ({ value: p.id, label: p.name }));

/** The rows of the indicators (src/domain/kpi.ts) from the shipments. */
export function kpiRows(views: readonly ShipmentView[]): KpiShipment[] {
  return views.filter((v) => v.s.state !== 'cancelled').map((v) => ({
    state: v.s.state as never, mode: v.s.mode as never, partnerId: v.booking?.partnerId ?? v.awarded?.partnerId ?? null,
    requestedOn: v.requests.map((r) => (r.submittedAt ?? r.createdAt).toISOString().slice(0, 10)).sort()[0] ?? null,
    neededOn: v.neededOn, bookedEta: v.booking?.eta ?? v.s.eta, atd: v.s.atd, ata: v.s.ata, deliveredOn: v.s.deliveredOn, chargeableKg: v.chargeable.kg,
    valueEur: v.valueEur, costEur: v.cost.invoicedEur || v.cost.quotedEur || null, incidents: v.incidents.length,
    shortageIncidents: v.incidents.filter((i) => i.type === 'shortage' || i.type === 'loss').length,
    quotedEur: v.cost.quotedEur || null, invoicedEur: v.costs.some((c) => c.invoiced != null) ? v.cost.invoicedEur : null,
  }));
}

/** "Atelier Nord → Mine du Plateau Rouge" (typed names shown as typed). */
export const routeOf = (v: ShipmentView) => `${v.from?.name ?? v.s.fromAddress ?? v.s.fromCountry} → ${v.to?.name ?? v.s.toAddress ?? v.s.toCountry}`;
