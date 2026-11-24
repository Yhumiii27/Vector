// Vector's closed vocabularies (docs/spec/01–04, 07). Pure: no I/O. Each list is used twice — by the database constraints
// (src/server/db/schema, CHECK … IN (…)) and by the forms and rules — so a value accepted by the application is accepted by
// the database and the other way round. Labels are EN source strings translated through t().

const make = <T extends string>(values: readonly T[]) => ({
  values,
  is: (v: unknown): v is T => typeof v === 'string' && (values as readonly string[]).includes(v),
});

export const REQUEST_ORIGINS = ['project', 'purchase_order', 'spare_part', 'site_return', 'other'] as const;
export type RequestOrigin = (typeof REQUEST_ORIGINS)[number];
export const RequestOrigin = make(REQUEST_ORIGINS);
export const REQUEST_ORIGIN_LABEL: Record<RequestOrigin, string> = {
  project: 'Project', purchase_order: 'Purchase order', spare_part: 'Spare part', site_return: 'Site return', other: 'Other',
};

export const REQUEST_STATES = ['draft', 'submitted', 'accepted', 'rejected', 'cancelled'] as const;
export type RequestState = (typeof REQUEST_STATES)[number];
export const RequestState = make(REQUEST_STATES);
export const REQUEST_STATE_LABEL: Record<RequestState, string> = {
  draft: 'Draft', submitted: 'Submitted', accepted: 'Accepted', rejected: 'Rejected', cancelled: 'Cancelled',
};

export const URGENCIES = ['normal', 'urgent', 'critical'] as const;
export type Urgency = (typeof URGENCIES)[number];
export const Urgency = make(URGENCIES);
export const URGENCY_LABEL: Record<Urgency, string> = { normal: 'Normal', urgent: 'Urgent', critical: 'Critical' };

export const MODES = ['road', 'sea', 'air', 'rail', 'express', 'multimodal'] as const;
export type Mode = (typeof MODES)[number];
export const Mode = make(MODES);
export const MODE_LABEL: Record<Mode, string> = {
  road: 'Road', sea: 'Sea', air: 'Air', rail: 'Rail', express: 'Express courier', multimodal: 'Multimodal',
};

export const FREIGHT_TYPES = ['parcel', 'ltl', 'ftl', 'fcl', 'lcl', 'breakbulk', 'roro', 'air_general', 'air_charter'] as const;
export type FreightType = (typeof FREIGHT_TYPES)[number];
export const FreightType = make(FREIGHT_TYPES);
export const FREIGHT_TYPE_LABEL: Record<FreightType, string> = {
  parcel: 'Parcel', ltl: 'Road groupage (LTL)', ftl: 'Full truck (FTL)', fcl: 'Full container (FCL)', lcl: 'Sea groupage (LCL)',
  breakbulk: 'Breakbulk', roro: 'Ro-Ro', air_general: 'Air cargo', air_charter: 'Air charter',
};

export const SHIPMENT_STATES = ['draft', 'planned', 'booked', 'picked_up', 'in_transit', 'arrived', 'delivered', 'closed', 'cancelled', 'on_hold'] as const;
export type ShipmentState = (typeof SHIPMENT_STATES)[number];
export const ShipmentState = make(SHIPMENT_STATES);
export const SHIPMENT_STATE_LABEL: Record<ShipmentState, string> = {
  draft: 'Draft', planned: 'Planned', booked: 'Booked', picked_up: 'Picked up', in_transit: 'In transit', arrived: 'Arrived',
  delivered: 'Delivered', closed: 'Closed', cancelled: 'Cancelled', on_hold: 'On hold',
};

export const PAYMENT_TERMS = ['open_account', 'letter_of_credit', 'cash_against_documents', 'prepaid'] as const;
export type PaymentTerm = (typeof PAYMENT_TERMS)[number];
export const PaymentTerm = make(PAYMENT_TERMS);
export const PAYMENT_TERM_LABEL: Record<PaymentTerm, string> = {
  open_account: 'Open account', letter_of_credit: 'Letter of credit', cash_against_documents: 'Cash against documents', prepaid: 'Prepaid',
};

export const INSURANCE_KINDS = ['none', 'buyer', 'policy', 'specific'] as const;
export type InsuranceKind = (typeof INSURANCE_KINDS)[number];
export const InsuranceKind = make(INSURANCE_KINDS);
export const INSURANCE_LABEL: Record<InsuranceKind, string> = {
  none: 'Not insured', buyer: 'Insured by the buyer', policy: 'Group annual policy', specific: 'Specific policy',
};

export const PACKAGE_TYPES = ['crate', 'box', 'pallet', 'skid', 'drum', 'bundle', 'unit', 'container', 'envelope'] as const;
export type PackageType = (typeof PACKAGE_TYPES)[number];
export const PackageType = make(PACKAGE_TYPES);
export const PACKAGE_TYPE_LABEL: Record<PackageType, string> = {
  crate: 'Wooden crate', box: 'Box', pallet: 'Pallet', skid: 'Skid', drum: 'Drum', bundle: 'Bundle', unit: 'Unpacked unit',
  container: 'Shipper-owned container', envelope: 'Envelope',
};

export const LOAD_TYPES = ['truck', 'c20', 'c40', 'c40hc', 'open_top', 'flat_rack', 'hold', 'deck', 'uld'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];
export const LoadType = make(LOAD_TYPES);
export const LOAD_TYPE_LABEL: Record<LoadType, string> = {
  truck: 'Truck (13.6 m trailer)', c20: 'Container 20′', c40: 'Container 40′', c40hc: 'Container 40′ HC', open_top: 'Open-top',
  flat_rack: 'Flat-rack', hold: 'Breakbulk — hold', deck: 'Breakbulk — deck', uld: 'Air unit load device',
};

export const PARTNER_KINDS = ['carrier', 'forwarder', 'express', 'packer', 'insurer', 'agent', 'customs_broker'] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];
export const PartnerKind = make(PARTNER_KINDS);
export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = {
  carrier: 'Carrier', forwarder: 'Freight forwarder', express: 'Express integrator', packer: 'Packer', insurer: 'Insurer',
  agent: 'Destination agent', customs_broker: 'Customs broker',
};

export const PARTNER_STATES = ['active', 'suspended', 'archived'] as const;
export type PartnerState = (typeof PARTNER_STATES)[number];
export const PartnerState = make(PARTNER_STATES);
export const PARTNER_STATE_LABEL: Record<PartnerState, string> = { active: 'Active', suspended: 'Suspended', archived: 'Archived' };

export const RFQ_STATES = ['draft', 'sent', 'closed', 'cancelled'] as const;
export type RfqState = (typeof RFQ_STATES)[number];
export const RfqState = make(RFQ_STATES);
export const RFQ_STATE_LABEL: Record<RfqState, string> = { draft: 'Draft', sent: 'Sent', closed: 'Awarded', cancelled: 'Cancelled' };

export const QUOTE_STATES = ['received', 'awarded', 'declined', 'expired'] as const;
export type QuoteState = (typeof QUOTE_STATES)[number];
export const QuoteState = make(QUOTE_STATES);
export const QUOTE_STATE_LABEL: Record<QuoteState, string> = { received: 'Received', awarded: 'Awarded', declined: 'Declined', expired: 'Expired' };

export const MILESTONE_CODES = [
  'ready', 'pickup', 'export_cleared', 'gate_in', 'loaded', 'departed', 'transshipment', 'arrived', 'import_cleared', 'out_for_delivery', 'delivered',
] as const;
export type MilestoneCode = (typeof MILESTONE_CODES)[number];
export const MilestoneCode = make(MILESTONE_CODES);
export const MILESTONE_LABEL: Record<MilestoneCode, string> = {
  ready: 'Goods ready', pickup: 'Pick-up', export_cleared: 'Export clearance', gate_in: 'Gate-in at terminal', loaded: 'Loaded on board',
  departed: 'Departure', transshipment: 'Transshipment', arrived: 'Arrival', import_cleared: 'Import clearance',
  out_for_delivery: 'On-carriage', delivered: 'Delivered',
};

export const CUSTOMS_PROCEDURES = ['export', 'temporary_export', 're_export', 'outward_processing', 'intra_eu', 'domestic'] as const;
export type CustomsProcedure = (typeof CUSTOMS_PROCEDURES)[number];
export const CustomsProcedure = make(CUSTOMS_PROCEDURES);
export const CUSTOMS_PROCEDURE_LABEL: Record<CustomsProcedure, string> = {
  export: 'Export (regime 10)', temporary_export: 'Temporary export (ATA carnet)', re_export: 'Re-export', outward_processing: 'Outward processing (repair)',
  intra_eu: 'Intra-EU movement', domestic: 'Domestic',
};

export const COMPLIANCE_CHECKS = ['destination', 'screening', 'dual_use', 'dangerous_goods', 'end_use'] as const;
export type ComplianceCheck = (typeof COMPLIANCE_CHECKS)[number];
export const ComplianceCheck = make(COMPLIANCE_CHECKS);
export const COMPLIANCE_CHECK_LABEL: Record<ComplianceCheck, string> = {
  destination: 'Destination and transit countries', screening: 'Consignee and end user screened against sanctions lists',
  dual_use: 'Dual-use goods and licence', dangerous_goods: 'Dangerous goods declaration', end_use: 'End-use certificate',
};

export const CHECK_STATES = ['pending', 'ok', 'na', 'blocked', 'waived'] as const;
export type CheckState = (typeof CHECK_STATES)[number];
export const CheckState = make(CHECK_STATES);
export const CHECK_STATE_LABEL: Record<CheckState, string> = { pending: 'To check', ok: 'Cleared', na: 'Not applicable', blocked: 'Blocked', waived: 'Waived' };

export const COUNTRY_RISKS = ['none', 'watch', 'restricted', 'embargoed'] as const;
export type CountryRisk = (typeof COUNTRY_RISKS)[number];
export const CountryRisk = make(COUNTRY_RISKS);
export const COUNTRY_RISK_LABEL: Record<CountryRisk, string> = { none: 'No restriction', watch: 'Under watch', restricted: 'Restricted', embargoed: 'Embargoed' };

export const DOCUMENT_KINDS = [
  'packing_list', 'proforma_invoice', 'commercial_invoice', 'marks', 'shipping_instructions', 'cmr', 'bill_of_lading', 'air_waybill',
  'export_declaration', 'certificate_of_origin', 'eur1', 'insurance_certificate', 'dg_declaration', 'sds', 'dual_use_licence',
  'end_use_certificate', 'ispm15', 'vgm', 'pod', 'lc_documents',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DocumentKind = make(DOCUMENT_KINDS);
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  packing_list: 'Packing list', proforma_invoice: 'Proforma invoice', commercial_invoice: 'Commercial invoice', marks: 'Package marks',
  shipping_instructions: 'Shipping instructions', cmr: 'CMR consignment note', bill_of_lading: 'Bill of lading', air_waybill: 'Air waybill',
  export_declaration: 'Export declaration (EX-A / MRN)', certificate_of_origin: 'Certificate of origin', eur1: 'EUR.1 / origin declaration',
  insurance_certificate: 'Insurance certificate', dg_declaration: 'Dangerous goods declaration', sds: 'Safety data sheet',
  dual_use_licence: 'Dual-use licence', end_use_certificate: 'End-use certificate', ispm15: 'ISPM 15 wood treatment', vgm: 'Verified gross mass (VGM)',
  pod: 'Proof of delivery', lc_documents: 'Letter of credit documents',
};

export const DOCUMENT_STATES = ['expected', 'received', 'checked', 'rejected', 'waived'] as const;
export type DocumentState = (typeof DOCUMENT_STATES)[number];
export const DocumentState = make(DOCUMENT_STATES);
export const DOCUMENT_STATE_LABEL: Record<DocumentState, string> = { expected: 'Expected', received: 'Received', checked: 'Checked', rejected: 'Rejected', waived: 'Not required' };

export const DOCUMENT_DUE = ['before_booking', 'before_pickup', 'before_departure', 'on_arrival', 'before_closure'] as const;
export type DocumentDue = (typeof DOCUMENT_DUE)[number];
export const DOCUMENT_DUE_LABEL: Record<DocumentDue, string> = {
  before_booking: 'Before booking', before_pickup: 'Before pick-up', before_departure: 'Before departure', on_arrival: 'On arrival', before_closure: 'Before closure',
};

export const INCIDENT_TYPES = ['delay', 'damage', 'loss', 'shortage', 'customs_hold', 'documents', 'safety', 'other'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];
export const IncidentType = make(INCIDENT_TYPES);
export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  delay: 'Delay', damage: 'Damage', loss: 'Loss', shortage: 'Shortage', customs_hold: 'Customs hold', documents: 'Document discrepancy', safety: 'Safety incident', other: 'Other',
};

export const SEVERITIES = ['minor', 'major', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];
export const Severity = make(SEVERITIES);
export const SEVERITY_LABEL: Record<Severity, string> = { minor: 'Minor', major: 'Major', critical: 'Critical' };

export const INCIDENT_STATES = ['open', 'claimed', 'settled', 'rejected', 'closed'] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];
export const IncidentState = make(INCIDENT_STATES);
export const INCIDENT_STATE_LABEL: Record<IncidentState, string> = { open: 'Open', claimed: 'Claim sent', settled: 'Settled', rejected: 'Claim rejected', closed: 'Closed' };

export const COST_CATEGORIES = ['freight', 'surcharges', 'port_handling', 'customs', 'duties_taxes', 'insurance', 'packing', 'storage', 'demurrage', 'detention', 'other'] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];
export const CostCategory = make(COST_CATEGORIES);
export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  freight: 'Freight', surcharges: 'Surcharges (fuel, currency)', port_handling: 'Terminal handling', customs: 'Customs clearance', duties_taxes: 'Duties and taxes',
  insurance: 'Insurance', packing: 'Packing', storage: 'Storage', demurrage: 'Demurrage', detention: 'Detention', other: 'Other',
};

export const OUTBOX_TARGETS = ['codex', 'vigie', 'mail', 'keystone'] as const;
export type OutboxTarget = (typeof OUTBOX_TARGETS)[number];
export const OUTBOX_STATES = ['pending', 'sent', 'failed'] as const;
export type OutboxState = (typeof OUTBOX_STATES)[number];

export const ZONES = ['europe', 'africa', 'americas', 'asia', 'oceania', 'middle_east'] as const;
export type Zone = (typeof ZONES)[number];
export const Zone = make(ZONES);
export const ZONE_LABEL: Record<Zone, string> = { europe: 'Europe', africa: 'Africa', americas: 'Americas', asia: 'Asia', oceania: 'Oceania', middle_east: 'Middle East' };

export const DG_PACKING_GROUPS = ['I', 'II', 'III'] as const;

/** Formats checked by the database and the forms. */
export const FORMATS = {
  requestRef: /^SR-[0-9]{4}-[0-9]{4}$/,
  shipmentRef: /^SH-[0-9]{4}-[0-9]{4}$/,
  rfqRef: /^RFQ-[0-9]{4}-[0-9]{4}$/,
  incidentRef: /^INC-[0-9]{4}-[0-9]{4}$/,
  country: /^[A-Z]{2}$/,
  currency: /^[A-Z]{3}$/,
  hsCode: /^[0-9]{6,10}$/,
  unNumber: /^UN[0-9]{4}$/,
  mrn: /^[0-9]{2}[A-Z]{2}[A-Z0-9]{13}[0-9]$/,
  container: /^[A-Z]{4}[0-9]{7}$/,
  costCode: /^[A-Z0-9-]{2,20}$/,
  projectCode: /^[A-Z0-9-]{2,20}$/,
  siteCode: /^[a-z0-9_-]{2,32}$/,
  location: /^[A-Z]{2}[A-Z0-9]{3}$/,
} as const;

/** The same formats as PostgreSQL regular expressions (CHECK … ~ '…'). */
export const PG_FORMATS: Record<keyof typeof FORMATS, string> = Object.fromEntries(
  Object.entries(FORMATS).map(([k, re]) => [k, re.source]),
) as Record<keyof typeof FORMATS, string>;
