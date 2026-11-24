// Document checklist of a shipment (docs/spec/03 § 3.1): the documents expected from its mode, freight type, Incoterm,
// origin and destination, customs procedure, dangerous goods, payment and insurance, each with its due stage. Pure; the
// recorded documents are matched by kind to say what is missing and what is late.
import { sellerInsures } from './incoterms';
import type { CustomsProcedure, DocumentDue, DocumentKind, DocumentState, FreightType, InsuranceKind, Mode, PaymentTerm, ShipmentState } from './vocab';

export interface ChecklistFacts {
  mode: Mode;
  freight: FreightType | null;
  incoterm: string | null;
  originCountry: string;
  destinationCountry: string;
  /** EU member countries (the reference table `countries.eu`). */
  euCountries: ReadonlySet<string>;
  procedure: CustomsProcedure | null;
  dangerousGoods: boolean;
  dualUse: boolean;
  /** The destination country's risk is `restricted`. */
  restrictedDestination: boolean;
  /** The destination needs an origin document (reference table, or the letter of credit asks for one). */
  originDocument: 'none' | 'eur1' | 'certificate';
  payment: PaymentTerm;
  /** Documents the letter of credit lists (in addition). */
  lcDocuments: readonly DocumentKind[];
  insurance: InsuranceKind;
  /** Wooden packaging (crates, skids, pallets): ISPM 15 for most destinations outside the EU. */
  woodPackaging: boolean;
}

export interface ExpectedDocument {
  kind: DocumentKind;
  due: DocumentDue;
  /** Why it is expected (EN source string). */
  why: string;
  /** Produced by Vector (generated) or referenced from elsewhere. */
  generated: boolean;
}

const GENERATED: ReadonlySet<DocumentKind> = new Set(['packing_list', 'proforma_invoice', 'marks', 'shipping_instructions', 'cmr', 'vgm']);

export function expectedDocuments(f: ChecklistFacts): ExpectedDocument[] {
  const out = new Map<DocumentKind, ExpectedDocument>();
  const add = (kind: DocumentKind, due: DocumentDue, why: string) => {
    if (!out.has(kind)) out.set(kind, { kind, due, why, generated: GENERATED.has(kind) });
  };
  const international = f.originCountry !== f.destinationCountry;
  const leavesEu = f.euCountries.has(f.originCountry) && !f.euCountries.has(f.destinationCountry);
  add('packing_list', 'before_pickup', 'Every shipment');
  if (f.freight !== 'parcel' || f.mode !== 'express') add('marks', 'before_pickup', 'Every package is marked');
  if (international && !(f.euCountries.has(f.originCountry) && f.euCountries.has(f.destinationCountry))) {
    add('proforma_invoice', 'before_booking', 'Customs value outside the EU');
    add('commercial_invoice', 'before_departure', 'Customs value outside the EU');
  }
  if (f.mode === 'sea' || f.mode === 'air' || f.mode === 'multimodal') add('shipping_instructions', 'before_booking', 'Basis of the bill of lading or air waybill');
  if (f.mode === 'road' && international) add('cmr', 'before_pickup', 'International road transport (CMR convention)');
  if (f.mode === 'sea' || (f.mode === 'multimodal' && f.freight !== 'air_general')) add('bill_of_lading', 'before_closure', 'Sea transport');
  if (f.mode === 'air' || f.mode === 'express') add('air_waybill', 'before_departure', 'Air transport');
  if (f.mode === 'sea' && (f.freight === 'fcl' || f.freight === 'lcl')) add('vgm', 'before_departure', 'Container by sea (SOLAS)');
  if (leavesEu && f.procedure !== 'intra_eu' && f.procedure !== 'domestic') add('export_declaration', 'before_departure', 'Goods leave the EU');
  if (f.originDocument === 'eur1') add('eur1', 'before_departure', 'Preferential origin for the destination');
  if (f.originDocument === 'certificate') add('certificate_of_origin', 'before_departure', 'Non-preferential origin asked by the destination');
  if (f.insurance === 'specific' || f.insurance === 'policy' || sellerInsures(f.incoterm)) add('insurance_certificate', 'before_departure', 'Goods insured by the group');
  if (f.dangerousGoods) {
    add('dg_declaration', 'before_booking', 'Dangerous goods on board');
    add('sds', 'before_booking', 'Dangerous goods on board');
  }
  if (f.dualUse) add('dual_use_licence', 'before_booking', 'Dual-use goods');
  if (f.restrictedDestination) add('end_use_certificate', 'before_booking', 'Restricted destination');
  if (f.woodPackaging && leavesEu) add('ispm15', 'before_pickup', 'Wooden packaging outside the EU');
  if (f.payment === 'letter_of_credit') {
    add('lc_documents', 'before_closure', 'Paid by letter of credit');
    for (const k of f.lcDocuments) add(k, 'before_departure', 'Asked by the letter of credit');
  }
  add('pod', 'before_closure', 'Every shipment');
  return [...out.values()];
}

export interface RecordedDocument {
  kind: DocumentKind;
  state: DocumentState;
}

/** The stage reached by a shipment state, to say which due stages are passed. */
const STAGE_ORDER: Record<DocumentDue, number> = { before_booking: 1, before_pickup: 2, before_departure: 3, on_arrival: 4, before_closure: 5 };
const STATE_STAGE: Record<ShipmentState, number> = { draft: 0, planned: 0, booked: 1, picked_up: 2, in_transit: 3, arrived: 4, delivered: 4, closed: 5, cancelled: 0, on_hold: 0 };

export interface ChecklistLine extends ExpectedDocument {
  state: DocumentState | 'missing';
  /** Present: received, checked, or waived. */
  done: boolean;
  /** Its stage is reached and it is not done. */
  late: boolean;
}

export function checklist(expected: readonly ExpectedDocument[], recorded: readonly RecordedDocument[], state: ShipmentState): ChecklistLine[] {
  const stage = STATE_STAGE[state];
  return expected.map((e) => {
    const r = recorded.find((x) => x.kind === e.kind);
    const st: ChecklistLine['state'] = r ? r.state : 'missing';
    const done = st === 'received' || st === 'checked' || st === 'waived';
    return { ...e, state: st, done, late: !done && STAGE_ORDER[e.due] <= stage };
  });
}

/** Count of documents due before pick-up that are not done (state machine, 'pickup'). */
export const missingBefore = (lines: readonly ChecklistLine[], due: DocumentDue) =>
  lines.filter((l) => !l.done && STAGE_ORDER[l.due] <= STAGE_ORDER[due]).length;

/** Letter-of-credit dates (UCP 600 defaults): latest shipment date and presentation within 21 days of shipment and before expiry. */
export function lcWarnings(lc: { latestShipment: string | null; expiry: string | null }, atd: string | null, etd: string | null, today: string, presentationDays = 21): string[] {
  const w: string[] = [];
  const ship = atd ?? etd;
  if (lc.latestShipment && ship && ship > lc.latestShipment) w.push(atd ? 'Shipped after the latest shipment date of the letter of credit' : 'Planned departure after the latest shipment date of the letter of credit');
  if (lc.expiry && today > lc.expiry) w.push('The letter of credit has expired');
  if (atd && lc.expiry) {
    const d = new Date(`${atd}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + presentationDays);
    const last = d.toISOString().slice(0, 10);
    const limit = last < lc.expiry ? last : lc.expiry;
    if (today > limit) w.push('The presentation period of the documents is over');
  }
  return w;
}
