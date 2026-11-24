// GET /export/<dataset> — CSV exports (docs/spec/04 § 4): shipments, requests, costs, incidents, partners. Read with the
// viewer's rights (values and costs only for the roles of U-2: a viewer without them gets the files without those columns, and
// no cost file). The export is journalled. Never cached.
import { canSeeValues } from '@/domain/rights';
import { toCsv } from '@/domain/csv';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { loadWorld } from '@/server/dal/world';
import { getViewer } from '@/server/session';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ dataset: string }> }): Promise<Response> {
  const [{ dataset }, viewer, today] = await Promise.all([params, getViewer(), businessToday()]);
  const w = await loadWorld(viewer, today);
  const values = canSeeValues(viewer.roles);
  let header: string[];
  let rows: unknown[][];
  switch (dataset) {
    case 'shipments':
      header = ['ref', 'title', 'state', 'mode', 'freight_type', 'incoterm', 'incoterm_place', 'from', 'from_country', 'to', 'to_country', 'packages', 'gross_kg', 'volume_m3', 'chargeable_kg', 'etd', 'atd', 'eta_current', 'ata', 'delivered_on', 'needed_on', 'delay_days', 'carrier', 'missing_documents', 'open_incidents', 'requests', 'projects', ...(values ? ['value_eur', 'quoted_eur', 'invoiced_eur'] : [])];
      rows = w.shipments.map((v) => [v.s.ref, v.s.title, v.s.state, v.s.mode, v.s.freightType, v.s.incoterm, v.s.incotermPlace, v.from?.name ?? v.s.fromAddress, v.s.fromCountry, v.to?.name ?? v.s.toAddress, v.s.toCountry,
        v.totals.packages, v.totals.grossKg, v.totals.volumeM3, v.chargeable.kg, v.s.etd, v.s.atd, v.late.eta, v.s.ata, v.s.deliveredOn, v.neededOn, v.late.actualDays ?? v.late.forecastDays, v.carrierName, v.missingDocs, v.openIncidents,
        v.requests.map((r) => r.ref).join(' '), v.requests.map((r) => r.projectCode ?? r.costCode).join(' '), ...(values ? [v.valueEur, v.cost.quotedEur, v.cost.invoicedEur] : [])]);
      break;
    case 'requests':
      header = ['ref', 'origin', 'title', 'project', 'cost_code', 'order', 'from_country', 'to_country', 'ready_on', 'needed_on', 'urgency', 'state', 'requested_by'];
      rows = w.requests.map((r) => [r.ref, r.origin, r.title, r.projectCode, r.costCode, r.orderRef, r.fromCountry, r.toCountry, r.readyOn, r.neededOn, r.urgency, r.state, r.requestedByName]);
      break;
    case 'costs':
      if (!values) return new Response('Not found', { status: 404 });
      header = ['shipment', 'imputation', 'category', 'partner', 'currency', 'estimated', 'quoted', 'invoiced', 'invoice_number', 'invoice_date', 'reconciled', 'variance_reason'];
      rows = w.shipments.flatMap((v) => v.costs.map((c) => [v.s.ref, v.requests.map((r) => r.projectCode ?? r.costCode).join(' '), c.category, c.partnerName, c.currency, c.estimated, c.quoted, c.invoiced, c.invoiceNumber, c.invoiceDate, c.reconciled ? 'yes' : 'no', c.varianceReason]));
      break;
    case 'incidents':
      header = ['ref', 'shipment', 'type', 'severity', 'occurred_on', 'place', 'description', 'partner', 'claimed', 'currency', 'claim_sent_on', 'recovered', 'state'];
      rows = w.shipments.flatMap((v) => v.incidents.map((i) => [i.ref, v.s.ref, i.type, i.severity, i.occurredOn, i.place, i.description, i.partnerName, i.claimedAmount, i.claimCurrency, i.claimSentOn, i.recoveredAmount, i.state]));
      break;
    case 'partners':
      header = ['name', 'kind', 'country', 'modes', 'zones', 'accreditations', 'state'];
      rows = w.partners.map((p) => [p.name, p.kind, p.country, p.modes.join(' '), p.zones.join(' '), p.accreditations, p.state]);
      break;
    default:
      return new Response('Not found', { status: 404 });
  }
  await writeAudit(await getDb(), { actorName: viewer.name, actorUserId: viewer.userId, actorRole: viewer.role, objectRef: `Export ${dataset}`, change: `${rows.length} rows exported`, area: 'Administration' });
  return new Response(toCsv(header, rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="vector-${dataset}-${today}.csv"`, 'Cache-Control': 'no-store' },
  });
}
