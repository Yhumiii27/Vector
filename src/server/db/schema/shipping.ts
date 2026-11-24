// Business tables of Vector (docs/spec/07). Every column has its constraint (Norma § 4): states and kinds from the closed
// vocabularies of src/domain/vocab.ts, codes by their format, positive measures, consistency between columns.
import { sql } from 'drizzle-orm';
import { boolean, check, date, doublePrecision, index, integer, jsonb, numeric, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import {
  CHECK_STATES, COMPLIANCE_CHECKS, COST_CATEGORIES, COUNTRY_RISKS, CUSTOMS_PROCEDURES, DG_PACKING_GROUPS, DOCUMENT_DUE, DOCUMENT_KINDS, DOCUMENT_STATES,
  FREIGHT_TYPES, INCIDENT_STATES, INCIDENT_TYPES, INSURANCE_KINDS, LOAD_TYPES, MILESTONE_CODES, MODES, OUTBOX_STATES, OUTBOX_TARGETS, PACKAGE_TYPES,
  PARTNER_KINDS, PARTNER_STATES, PAYMENT_TERMS, PG_FORMATS as F, QUOTE_STATES, REQUEST_ORIGINS, REQUEST_STATES, RFQ_STATES, SEVERITIES,
  SHIPMENT_STATES, URGENCIES, ZONES,
} from '@/domain/vocab';
import { vector } from './_schema';
import { id, inList, matches, notBlank, timestamps } from './_common';
import { users } from './platform';

/** numeric(14,2) read as a number. */
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: 'number' });
const qty = (name: string) => numeric(name, { precision: 14, scale: 3, mode: 'number' });

// ── Reference lists ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Sites: mirror of matrix.pub_sites (source matrix) or a demonstration / local address book entry. */
export const sites = vector.table('sites', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  city: text('city'),
  country: text('country').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  source: text('source').notNull(),
  active: boolean('active').notNull().default(true),
}, (t) => [
  check('sites_code_check', matches(t.code, F.siteCode)),
  check('sites_name_check', notBlank(t.name)),
  check('sites_kind_check', inList(t.kind, ['workshop', 'warehouse', 'supplier', 'mine', 'port', 'office'])),
  check('sites_country_check', matches(t.country, F.country)),
  check('sites_source_check', inList(t.source, ['matrix', 'local', 'demo'])),
  check('sites_coords_check', sql`(${t.latitude} is null) = (${t.longitude} is null) and (${t.latitude} is null or (${t.latitude} between -90 and 90 and ${t.longitude} between -180 and 180))`),
]);

export const countries = vector.table('countries', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  eu: boolean('eu').notNull().default(false),
  zone: text('zone').notNull(),
  risk: text('risk').notNull().default('none'),
  originDocument: text('origin_document').notNull().default('none'),
  note: text('note'),
}, (t) => [
  check('countries_code_check', matches(t.code, F.country)),
  check('countries_name_check', notBlank(t.name)),
  check('countries_zone_check', inList(t.zone, ZONES)),
  check('countries_risk_check', inList(t.risk, COUNTRY_RISKS)),
  check('countries_origin_check', inList(t.originDocument, ['none', 'eur1', 'certificate'])),
]);

export const incoterms = vector.table('incoterms', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  seaOnly: boolean('sea_only').notNull(),
  position: integer('position').notNull(),
}, (t) => [check('incoterms_code_check', sql`${t.code} ~ '^[A-Z]{3}$'`), check('incoterms_name_check', notBlank(t.name))]);

export const hsCodes = vector.table('hs_codes', {
  code: text('code').primaryKey(),
  description: text('description').notNull(),
  dualUseCode: text('dual_use_code'),
  validated: boolean('validated').notNull().default(false),
}, (t) => [
  check('hs_codes_code_check', matches(t.code, F.hsCode)),
  check('hs_codes_description_check', notBlank(t.description)),
  check('hs_codes_dual_use_check', sql`${t.dualUseCode} is null or ${t.dualUseCode} ~ '^[0-9][A-E][0-9]{3}[a-z0-9.]*$'`),
]);

export const exchangeRates = vector.table('exchange_rates', {
  currency: text('currency').notNull(),
  on: date('on').notNull(),
  perEur: numeric('per_eur', { precision: 14, scale: 6, mode: 'number' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.currency, t.on] }),
  check('exchange_rates_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$' and ${t.currency} <> 'EUR'`),
  check('exchange_rates_rate_check', sql`${t.perEur} > 0`),
]);

export const costStandards = vector.table('cost_standards', {
  mode: text('mode').notNull(),
  zone: text('zone').notNull(),
  eurPerKg: numeric('eur_per_kg', { precision: 10, scale: 3, mode: 'number' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.mode, t.zone] }),
  check('cost_standards_mode_check', inList(t.mode, MODES)),
  check('cost_standards_zone_check', inList(t.zone, ZONES)),
  check('cost_standards_value_check', sql`${t.eurPerKg} > 0`),
]);

export const packagingStandards = vector.table('packaging_standards', {
  code: text('code').primaryKey(),
  type: text('type').notNull(),
  lengthCm: integer('length_cm').notNull(),
  widthCm: integer('width_cm').notNull(),
  heightCm: integer('height_cm').notNull(),
  tareKg: numeric('tare_kg', { precision: 10, scale: 1, mode: 'number' }).notNull(),
  maxKg: numeric('max_kg', { precision: 10, scale: 1, mode: 'number' }).notNull(),
  norm: text('norm'),
}, (t) => [
  check('packaging_code_check', sql`${t.code} ~ '^[A-Z0-9-]{2,20}$'`),
  check('packaging_type_check', inList(t.type, PACKAGE_TYPES)),
  check('packaging_dims_check', sql`${t.lengthCm} > 0 and ${t.widthCm} > 0 and ${t.heightCm} > 0 and ${t.tareKg} >= 0 and ${t.maxKg} > 0`),
]);

// ── Partners ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export const partners = vector.table('partners', {
  id: id(),
  name: text('name').notNull().unique(),
  kind: text('kind').notNull(),
  country: text('country').notNull(),
  modes: text('modes').array().notNull(),
  zones: text('zones').array().notNull(),
  accreditations: text('accreditations'),
  contactRole: text('contact_role'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  state: text('state').notNull().default('active'),
  stateReason: text('state_reason'),
  ...timestamps,
}, (t) => [
  check('partners_name_check', notBlank(t.name)),
  check('partners_kind_check', inList(t.kind, PARTNER_KINDS)),
  check('partners_country_check', matches(t.country, F.country)),
  check('partners_modes_check', sql`cardinality(${t.modes}) > 0 and ${t.modes} <@ array[${sql.raw(MODES.map((m) => `'${m}'`).join(','))}]::text[]`),
  check('partners_zones_check', sql`${t.zones} <@ array[${sql.raw(ZONES.map((m) => `'${m}'`).join(','))}]::text[]`),
  check('partners_state_check', inList(t.state, PARTNER_STATES)),
  check('partners_reason_check', sql`${t.state} = 'active' or btrim(coalesce(${t.stateReason}, '')) <> ''`),
  check('partners_email_check', sql`${t.contactEmail} is null or ${t.contactEmail} ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'`),
]);

// ── Requests and shipments ───────────────────────────────────────────────────────────────────────────────────────────

export const shipmentRequests = vector.table('shipment_requests', {
  id: id(),
  ref: text('ref').notNull().unique(),
  origin: text('origin').notNull(),
  title: text('title').notNull(),
  projectCode: text('project_code'),
  costCode: text('cost_code'),
  orderRef: text('order_ref'),
  fromSite: text('from_site').references(() => sites.code),
  fromAddress: text('from_address'),
  fromCountry: text('from_country').notNull(),
  toSite: text('to_site').references(() => sites.code),
  toAddress: text('to_address'),
  toCountry: text('to_country').notNull(),
  readyOn: date('ready_on').notNull(),
  neededOn: date('needed_on').notNull(),
  urgency: text('urgency').notNull().default('normal'),
  description: text('description').notNull(),
  estimatedKg: numeric('estimated_kg', { precision: 12, scale: 1, mode: 'number' }),
  estimatedM3: numeric('estimated_m3', { precision: 10, scale: 3, mode: 'number' }),
  estimatedValueEur: money('estimated_value_eur'),
  dangerousGoods: text('dangerous_goods').notNull().default('unknown'),
  incoterm: text('incoterm').references(() => incoterms.code),
  incotermPlace: text('incoterm_place'),
  state: text('state').notNull().default('draft'),
  stateReason: text('state_reason'),
  requestedById: uuid('requested_by_id').notNull().references(() => users.id),
  requestedByName: text('requested_by_name').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  ...timestamps,
}, (t) => [
  check('requests_ref_check', matches(t.ref, F.requestRef)),
  check('requests_origin_check', inList(t.origin, REQUEST_ORIGINS)),
  check('requests_title_check', notBlank(t.title)),
  check('requests_description_check', notBlank(t.description)),
  check('requests_imputation_check', sql`${t.projectCode} is not null or ${t.costCode} is not null`),
  check('requests_project_check', sql`${t.projectCode} is null or ${t.projectCode} ~ '${sql.raw(F.projectCode)}'`),
  check('requests_cost_code_check', sql`${t.costCode} is null or ${t.costCode} ~ '${sql.raw(F.costCode)}'`),
  check('requests_from_check', sql`${t.fromSite} is not null or btrim(coalesce(${t.fromAddress}, '')) <> ''`),
  check('requests_to_check', sql`${t.toSite} is not null or btrim(coalesce(${t.toAddress}, '')) <> ''`),
  check('requests_countries_check', sql`${t.fromCountry} ~ '^[A-Z]{2}$' and ${t.toCountry} ~ '^[A-Z]{2}$'`),
  check('requests_dates_check', sql`${t.readyOn} <= ${t.neededOn}`),
  check('requests_urgency_check', inList(t.urgency, URGENCIES)),
  check('requests_dg_check', inList(t.dangerousGoods, ['yes', 'no', 'unknown'])),
  check('requests_estimates_check', sql`coalesce(${t.estimatedKg}, 1) > 0 and coalesce(${t.estimatedM3}, 1) > 0 and coalesce(${t.estimatedValueEur}, 0) >= 0`),
  check('requests_state_check', inList(t.state, REQUEST_STATES)),
  check('requests_reason_check', sql`${t.state} not in ('rejected', 'cancelled') or btrim(coalesce(${t.stateReason}, '')) <> ''`),
  index('requests_state_idx').on(t.state),
]);

export const shipments = vector.table('shipments', {
  id: id(),
  ref: text('ref').notNull().unique(),
  title: text('title').notNull(),
  mode: text('mode').notNull(),
  freightType: text('freight_type'),
  incoterm: text('incoterm').references(() => incoterms.code),
  incotermPlace: text('incoterm_place'),
  fromSite: text('from_site').references(() => sites.code),
  fromAddress: text('from_address'),
  fromCountry: text('from_country').notNull(),
  toSite: text('to_site').references(() => sites.code),
  toAddress: text('to_address'),
  toCountry: text('to_country').notNull(),
  portOfLoading: text('port_of_loading'),
  portOfDischarge: text('port_of_discharge'),
  coordinatorId: uuid('coordinator_id').references(() => users.id),
  coordinatorName: text('coordinator_name'),
  payment: text('payment').notNull().default('open_account'),
  lcNumber: text('lc_number'),
  lcBank: text('lc_bank'),
  lcLatestShipment: date('lc_latest_shipment'),
  lcExpiry: date('lc_expiry'),
  lcDocuments: text('lc_documents').array().notNull().default(sql`'{}'::text[]`),
  insurance: text('insurance').notNull().default('policy'),
  readyOn: date('ready_on'),
  etd: date('etd'),
  eta: date('eta'),
  latestEta: date('latest_eta'),
  pickedUpOn: date('picked_up_on'),
  atd: date('atd'),
  ata: date('ata'),
  deliveredOn: date('delivered_on'),
  podSignedBy: text('pod_signed_by'),
  podCodexRef: text('pod_codex_ref'),
  deliveryReserves: text('delivery_reserves'),
  packingValidatedAt: timestamp('packing_validated_at', { withTimezone: true }),
  state: text('state').notNull().default('draft'),
  previousState: text('previous_state'),
  stateReason: text('state_reason'),
  /** Reference of the shipment in Keystone before the transition (EXP-01 of a project), kept as an alias. */
  keystoneRef: text('keystone_ref'),
  ...timestamps,
}, (t) => [
  check('shipments_ref_check', matches(t.ref, F.shipmentRef)),
  check('shipments_title_check', notBlank(t.title)),
  check('shipments_mode_check', inList(t.mode, MODES)),
  check('shipments_freight_check', sql`${t.freightType} is null or ${inList(t.freightType, FREIGHT_TYPES)}`),
  check('shipments_from_check', sql`${t.fromSite} is not null or btrim(coalesce(${t.fromAddress}, '')) <> ''`),
  check('shipments_to_check', sql`${t.toSite} is not null or btrim(coalesce(${t.toAddress}, '')) <> ''`),
  check('shipments_countries_check', sql`${t.fromCountry} ~ '^[A-Z]{2}$' and ${t.toCountry} ~ '^[A-Z]{2}$'`),
  check('shipments_ports_check', sql`(${t.portOfLoading} is null or ${t.portOfLoading} ~ '${sql.raw(F.location)}') and (${t.portOfDischarge} is null or ${t.portOfDischarge} ~ '${sql.raw(F.location)}')`),
  check('shipments_payment_check', inList(t.payment, PAYMENT_TERMS)),
  check('shipments_lc_check', sql`${t.payment} <> 'letter_of_credit' or btrim(coalesce(${t.lcNumber}, '')) <> ''`),
  check('shipments_lc_dates_check', sql`${t.lcLatestShipment} is null or ${t.lcExpiry} is null or ${t.lcLatestShipment} <= ${t.lcExpiry}`),
  check('shipments_lc_documents_check', sql`${t.lcDocuments} <@ array[${sql.raw(DOCUMENT_KINDS.map((m) => `'${m}'`).join(','))}]::text[]`),
  check('shipments_insurance_check', inList(t.insurance, INSURANCE_KINDS)),
  check('shipments_dates_check', sql`(${t.etd} is null or ${t.eta} is null or ${t.etd} <= ${t.eta}) and (${t.atd} is null or ${t.ata} is null or ${t.atd} <= ${t.ata}) and (${t.ata} is null or ${t.deliveredOn} is null or ${t.ata} <= ${t.deliveredOn})`),
  check('shipments_state_check', inList(t.state, SHIPMENT_STATES)),
  check('shipments_previous_state_check', sql`(${t.state} = 'on_hold') = (${t.previousState} is not null) and (${t.previousState} is null or ${inList(t.previousState, SHIPMENT_STATES)})`),
  check('shipments_reason_check', sql`${t.state} not in ('cancelled', 'on_hold') or btrim(coalesce(${t.stateReason}, '')) <> ''`),
  check('shipments_pod_check', sql`${t.state} not in ('delivered', 'closed') or (${t.deliveredOn} is not null and btrim(coalesce(${t.podCodexRef}, '')) <> '')`),
  index('shipments_state_idx').on(t.state),
  index('shipments_updated_at_idx').on(t.updatedAt),
]);

/** What a shipment carries: one row per request it serves, with the imputation and the share of the costs. */
export const shipmentAllocations = vector.table('shipment_allocations', {
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  requestId: uuid('request_id').notNull().references(() => shipmentRequests.id),
  /** Share of the costs (0–1); null = prorata of the chargeable weight (D-7). */
  share: numeric('share', { precision: 5, scale: 4, mode: 'number' }),
  shareReason: text('share_reason'),
}, (t) => [
  primaryKey({ columns: [t.shipmentId, t.requestId] }),
  check('allocations_share_check', sql`${t.share} is null or (${t.share} >= 0 and ${t.share} <= 1 and btrim(coalesce(${t.shareReason}, '')) <> '')`),
]);

export const loads = vector.table('loads', {
  id: id(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  number: integer('number').notNull(),
  type: text('type').notNull(),
  identifier: text('identifier'),
  seal: text('seal'),
}, (t) => [
  unique('loads_number_unique').on(t.shipmentId, t.number),
  check('loads_number_check', sql`${t.number} > 0`),
  check('loads_type_check', inList(t.type, LOAD_TYPES)),
  check('loads_container_check', sql`${t.type} not in ('c20', 'c40', 'c40hc', 'open_top', 'flat_rack') or ${t.identifier} is null or ${t.identifier} ~ '${sql.raw(F.container)}'`),
]);

export const packages = vector.table('packages', {
  id: id(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  loadId: uuid('load_id').references(() => loads.id),
  number: integer('number').notNull(),
  type: text('type').notNull(),
  lengthCm: integer('length_cm').notNull(),
  widthCm: integer('width_cm').notNull(),
  heightCm: integer('height_cm').notNull(),
  grossKg: numeric('gross_kg', { precision: 10, scale: 1, mode: 'number' }).notNull(),
  netKg: numeric('net_kg', { precision: 10, scale: 1, mode: 'number' }).notNull(),
  stackable: boolean('stackable').notNull().default(true),
  packagingCode: text('packaging_code').references(() => packagingStandards.code),
  description: text('description').notNull(),
  photosCodexRef: text('photos_codex_ref'),
}, (t) => [
  unique('packages_number_unique').on(t.shipmentId, t.number),
  check('packages_number_check', sql`${t.number} > 0`),
  check('packages_type_check', inList(t.type, PACKAGE_TYPES)),
  check('packages_dims_check', sql`${t.lengthCm} between 1 and 5000 and ${t.widthCm} between 1 and 2000 and ${t.heightCm} between 1 and 2000`),
  check('packages_weights_check', sql`${t.netKg} > 0 and ${t.netKg} <= ${t.grossKg} and ${t.grossKg} <= 500000`),
  check('packages_description_check', notBlank(t.description)),
]);

export const packageLines = vector.table('package_lines', {
  id: id(),
  packageId: uuid('package_id').notNull().references(() => packages.id),
  partRef: text('part_ref'),
  description: text('description').notNull(),
  quantity: qty('quantity').notNull(),
  unit: text('unit').notNull().default('pc'),
  hsCode: text('hs_code'),
  originCountry: text('origin_country'),
  unitValue: money('unit_value').notNull(),
  currency: text('currency').notNull().default('EUR'),
  netKg: numeric('net_kg', { precision: 10, scale: 1, mode: 'number' }),
  orderRef: text('order_ref'),
  dualUseCode: text('dual_use_code'),
  unNumber: text('un_number'),
  dgClass: text('dg_class'),
  dgPackingGroup: text('dg_packing_group'),
}, (t) => [
  check('lines_description_check', notBlank(t.description)),
  check('lines_quantity_check', sql`${t.quantity} > 0`),
  check('lines_unit_check', inList(t.unit, ['pc', 'set', 'kg', 'm', 'l'])),
  check('lines_hs_check', sql`${t.hsCode} is null or ${t.hsCode} ~ '${sql.raw(F.hsCode)}'`),
  check('lines_origin_check', sql`${t.originCountry} is null or ${t.originCountry} ~ '^[A-Z]{2}$'`),
  check('lines_value_check', sql`${t.unitValue} >= 0 and ${t.currency} ~ '^[A-Z]{3}$' and coalesce(${t.netKg}, 1) > 0`),
  check('lines_dual_use_check', sql`${t.dualUseCode} is null or ${t.dualUseCode} ~ '^[0-9][A-E][0-9]{3}[a-z0-9.]*$'`),
  check('lines_dg_check', sql`(${t.unNumber} is null and ${t.dgClass} is null and ${t.dgPackingGroup} is null) or (${t.unNumber} ~ '${sql.raw(F.unNumber)}' and ${t.dgClass} ~ '^[1-9](\\.[1-6])?$' and (${t.dgPackingGroup} is null or ${inList(t.dgPackingGroup, DG_PACKING_GROUPS)}))`),
]);

// ── Transport ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const rfqs = vector.table('rfqs', {
  id: id(),
  ref: text('ref').notNull().unique(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  scope: text('scope').notNull().default('door_to_door'),
  dueOn: date('due_on').notNull(),
  state: text('state').notNull().default('draft'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  note: text('note'),
  ...timestamps,
}, (t) => [
  check('rfqs_ref_check', matches(t.ref, F.rfqRef)),
  check('rfqs_scope_check', inList(t.scope, ['door_to_door', 'pre_carriage', 'main_carriage', 'on_carriage'])),
  check('rfqs_state_check', inList(t.state, RFQ_STATES)),
  check('rfqs_sent_check', sql`${t.state} = 'draft' or ${t.state} = 'cancelled' or ${t.sentAt} is not null`),
]);

/** Partners invited to an RFQ (answer time feeds the carrier score). */
export const rfqInvitations = vector.table('rfq_invitations', {
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  declined: boolean('declined').notNull().default(false),
}, (t) => [primaryKey({ columns: [t.rfqId, t.partnerId] }), check('invitations_answer_check', sql`${t.answeredAt} is null or ${t.answeredAt} >= ${t.invitedAt}`)]);

export const quotes = vector.table('quotes', {
  id: id(),
  rfqId: uuid('rfq_id').notNull().references(() => rfqs.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  amount: money('amount').notNull(),
  currency: text('currency').notNull(),
  breakdown: jsonb('breakdown').$type<Partial<Record<string, number>>>().notNull().default({}),
  transitDays: integer('transit_days').notNull(),
  departureOn: date('departure_on'),
  validUntil: date('valid_until').notNull(),
  conditions: text('conditions'),
  codexRef: text('codex_ref'),
  state: text('state').notNull().default('received'),
  awardReason: text('award_reason'),
  awardedAt: timestamp('awarded_at', { withTimezone: true }),
  awardedByName: text('awarded_by_name'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
}, (t) => [
  unique('quotes_partner_unique').on(t.rfqId, t.partnerId),
  check('quotes_amount_check', sql`${t.amount} >= 0 and ${t.currency} ~ '^[A-Z]{3}$'`),
  check('quotes_transit_check', sql`${t.transitDays} between 0 and 365`),
  check('quotes_state_check', inList(t.state, QUOTE_STATES)),
  check('quotes_awarded_check', sql`(${t.state} = 'awarded') = (${t.awardedAt} is not null)`),
]);

export const bookings = vector.table('bookings', {
  shipmentId: uuid('shipment_id').primaryKey().references(() => shipments.id),
  partnerId: uuid('partner_id').notNull().references(() => partners.id),
  number: text('number').notNull(),
  vessel: text('vessel'),
  voyage: text('voyage'),
  masterDocument: text('master_document'),
  houseDocument: text('house_document'),
  docsCutoff: timestamp('docs_cutoff', { withTimezone: true }),
  vgmCutoff: timestamp('vgm_cutoff', { withTimezone: true }),
  cargoCutoff: timestamp('cargo_cutoff', { withTimezone: true }),
  etd: date('etd'),
  eta: date('eta'),
  ...timestamps,
}, (t) => [
  check('bookings_number_check', notBlank(t.number)),
  check('bookings_dates_check', sql`${t.etd} is null or ${t.eta} is null or ${t.etd} <= ${t.eta}`),
  check('bookings_cutoffs_check', sql`${t.docsCutoff} is null or ${t.cargoCutoff} is null or ${t.docsCutoff} <= ${t.cargoCutoff} + interval '7 days'`),
]);

export const milestones = vector.table('milestones', {
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  code: text('code').notNull(),
  plannedOn: date('planned_on'),
  actualOn: date('actual_on'),
  place: text('place'),
  note: text('note'),
  source: text('source').notNull().default('manual'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.shipmentId, t.code] }),
  check('milestones_code_check', inList(t.code, MILESTONE_CODES)),
  check('milestones_source_check', inList(t.source, ['manual', 'tracking'])),
  check('milestones_dates_check', sql`${t.plannedOn} is not null or ${t.actualOn} is not null`),
]);

/** Tracking events received from the (simulated) tracking connector, applied to the milestones. Append-only by use. */
export const trackingEvents = vector.table('tracking_events', {
  id: id(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  code: text('code').notNull(),
  occurredOn: date('occurred_on').notNull(),
  eta: date('eta'),
  place: text('place'),
  provider: text('provider').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  applied: boolean('applied').notNull().default(false),
}, (t) => [check('tracking_code_check', inList(t.code, MILESTONE_CODES)), check('tracking_provider_check', inList(t.provider, ['simulation']))]);

// ── Customs, compliance and documents ────────────────────────────────────────────────────────────────────────────────

export const customsDeclarations = vector.table('customs_declarations', {
  shipmentId: uuid('shipment_id').primaryKey().references(() => shipments.id),
  procedure: text('procedure').notNull(),
  declarantId: uuid('declarant_id').references(() => partners.id),
  mrn: text('mrn'),
  lodgedOn: date('lodged_on'),
  exitOn: date('exit_on'),
  exitCodexRef: text('exit_codex_ref'),
  note: text('note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('customs_procedure_check', inList(t.procedure, CUSTOMS_PROCEDURES)),
  check('customs_mrn_check', sql`${t.mrn} is null or ${t.mrn} ~ '${sql.raw(F.mrn)}'`),
  check('customs_exit_check', sql`${t.exitOn} is null or (${t.mrn} is not null and (${t.lodgedOn} is null or ${t.lodgedOn} <= ${t.exitOn}))`),
]);

export const complianceChecks = vector.table('compliance_checks', {
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  check: text('check').notNull(),
  state: text('state').notNull().default('pending'),
  detail: text('detail'),
  evidenceCodexRef: text('evidence_codex_ref'),
  reason: text('reason'),
  byName: text('by_name'),
  at: timestamp('at', { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.shipmentId, t.check] }),
  check('compliance_check_check', inList(t.check, COMPLIANCE_CHECKS)),
  check('compliance_state_check', inList(t.state, CHECK_STATES)),
  check('compliance_reason_check', sql`${t.state} <> 'waived' or btrim(coalesce(${t.reason}, '')) <> ''`),
  check('compliance_by_check', sql`${t.state} = 'pending' or (${t.byName} is not null and ${t.at} is not null)`),
]);

export const shipmentDocuments = vector.table('shipment_documents', {
  id: id(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  kind: text('kind').notNull(),
  state: text('state').notNull().default('expected'),
  number: text('number'),
  issuedOn: date('issued_on'),
  codexRef: text('codex_ref'),
  generated: boolean('generated').notNull().default(false),
  reason: text('reason'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByName: text('updated_by_name').notNull(),
}, (t) => [
  unique('documents_kind_unique').on(t.shipmentId, t.kind),
  check('documents_kind_check', inList(t.kind, DOCUMENT_KINDS)),
  check('documents_state_check', inList(t.state, DOCUMENT_STATES)),
  check('documents_reference_check', sql`${t.state} not in ('received', 'checked') or btrim(coalesce(${t.codexRef}, '')) <> ''`),
  check('documents_reason_check', sql`${t.state} not in ('waived', 'rejected') or btrim(coalesce(${t.reason}, '')) <> ''`),
  check('documents_codex_check', sql`${t.codexRef} is null or ${t.codexRef} ~ '^[A-Z]{2,5}-[A-Z0-9-]{1,40}$'`),
]);

/** Due stage of each document kind is computed (src/domain/documents.ts); kept here only as a vocabulary guard. */
export const DOCUMENT_DUE_VALUES = DOCUMENT_DUE;

// ── Incidents and costs ──────────────────────────────────────────────────────────────────────────────────────────────

export const incidents = vector.table('incidents', {
  id: id(),
  ref: text('ref').notNull().unique(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  occurredOn: date('occurred_on').notNull(),
  place: text('place'),
  description: text('description').notNull(),
  reservesWritten: boolean('reserves_written').notNull().default(false),
  photosCodexRef: text('photos_codex_ref'),
  partnerId: uuid('partner_id').references(() => partners.id),
  claimedAmount: money('claimed_amount'),
  claimCurrency: text('claim_currency'),
  claimSentOn: date('claim_sent_on'),
  recoveredAmount: money('recovered_amount'),
  state: text('state').notNull().default('open'),
  stateReason: text('state_reason'),
  reportedByName: text('reported_by_name').notNull(),
  ...timestamps,
}, (t) => [
  check('incidents_ref_check', matches(t.ref, F.incidentRef)),
  check('incidents_type_check', inList(t.type, INCIDENT_TYPES)),
  check('incidents_severity_check', inList(t.severity, SEVERITIES)),
  check('incidents_description_check', notBlank(t.description)),
  check('incidents_state_check', inList(t.state, INCIDENT_STATES)),
  check('incidents_claim_check', sql`(${t.claimedAmount} is null or (${t.claimedAmount} >= 0 and ${t.claimCurrency} ~ '^[A-Z]{3}$')) and coalesce(${t.recoveredAmount}, 0) >= 0`),
  check('incidents_claimed_check', sql`${t.state} not in ('claimed', 'settled', 'rejected') or (${t.claimedAmount} is not null and ${t.claimSentOn} is not null)`),
  check('incidents_reason_check', sql`${t.state} <> 'closed' or btrim(coalesce(${t.stateReason}, '')) <> ''`),
]);

export const costLines = vector.table('cost_lines', {
  id: id(),
  shipmentId: uuid('shipment_id').notNull().references(() => shipments.id),
  category: text('category').notNull(),
  partnerId: uuid('partner_id').references(() => partners.id),
  currency: text('currency').notNull(),
  estimated: money('estimated'),
  quoted: money('quoted'),
  invoiced: money('invoiced'),
  invoiceNumber: text('invoice_number'),
  invoiceDate: date('invoice_date'),
  reconciled: boolean('reconciled').notNull().default(false),
  varianceReason: text('variance_reason'),
  source: text('source').notNull().default('manual'),
  ...timestamps,
}, (t) => [
  check('costs_category_check', inList(t.category, COST_CATEGORIES)),
  check('costs_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  check('costs_amounts_check', sql`coalesce(${t.estimated}, 0) >= 0 and coalesce(${t.quoted}, 0) >= 0 and coalesce(${t.invoiced}, 0) >= 0`),
  check('costs_some_check', sql`${t.estimated} is not null or ${t.quoted} is not null or ${t.invoiced} is not null`),
  check('costs_invoice_check', sql`(${t.invoiced} is null) = (${t.invoiceDate} is null) and (${t.invoiced} is null or btrim(coalesce(${t.invoiceNumber}, '')) <> '')`),
  check('costs_reconciled_check', sql`not ${t.reconciled} or ${t.invoiced} is not null`),
  check('costs_source_check', inList(t.source, ['manual', 'quote', 'sage', 'estimate'])),
]);

// ── Connectors ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Outbox to the other tools (Codex deposits, Vigie notices, e-mails): written in the business transaction, sent by a job. */
export const outbox = vector.table('outbox', {
  id: id(),
  target: text('target').notNull(),
  kind: text('kind').notNull(),
  shipmentId: uuid('shipment_id').references(() => shipments.id),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  state: text('state').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  resultRef: text('result_ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (t) => [
  check('outbox_target_check', inList(t.target, OUTBOX_TARGETS)),
  check('outbox_kind_check', sql`${t.kind} ~ '^[a-z_]{2,40}$'`),
  check('outbox_state_check', inList(t.state, OUTBOX_STATES)),
  check('outbox_sent_check', sql`(${t.state} = 'sent') = (${t.sentAt} is not null) and ${t.attempts} >= 0`),
  index('outbox_state_idx').on(t.state),
]);
