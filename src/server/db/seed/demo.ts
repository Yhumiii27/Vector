// Demonstration data set — entirely fictitious (choice C-6): sites "Atelier Nord", mines invented in real countries,
// partners "Transports Alpha"…, projects DEMO-1xx, people of demo.example. Dated around DEMO_TODAY_ISO (Tue 24 Nov 2026) so every
// state of a shipment, every alert and every indicator has something to show.
import { DEMO_TODAY_ISO } from '@/domain/clock';
import { addDaysIso } from '@/lib/dates';
import {
  bookings, complianceChecks, costLines, counters, customsDeclarations, exchangeRates, hsCodes, incidents, loads, milestones, outbox, packageLines,
  packages, partners, quotes, rfqInvitations, rfqs, shipmentAllocations, shipmentDocuments, shipmentRequests, shipments, sites, users,
} from '../schema';
import type { Tx } from '../types';
import { DEMO_PERSONAS } from './personas';
import type { ComplianceCheck, CheckState, DocumentKind, DocumentState, MilestoneCode } from '@/domain/vocab';

const T = DEMO_TODAY_ISO;
const d = (n: number) => addDaysIso(T, n);
const at = (n: number, hh = 9) => new Date(`${d(n)}T${String(hh).padStart(2, '0')}:00:00Z`);

export const DEMO_SITES = [
  { code: 'atelier-nord', name: 'Atelier Nord', kind: 'workshop', city: 'Ville-Nord', country: 'FR', latitude: 48.6, longitude: 7.75 },
  { code: 'atelier-sud', name: 'Atelier Sud', kind: 'workshop', city: 'Ville-Sud', country: 'FR', latitude: 43.6, longitude: 3.9 },
  { code: 'magasin-pieces', name: 'Magasin pièces de rechange', kind: 'warehouse', city: 'Ville-Centre', country: 'FR', latitude: 45.75, longitude: 4.85 },
  { code: 'fournisseur-orion', name: 'Fournisseur Orion Hydraulique', kind: 'supplier', city: 'Stadt-West', country: 'DE', latitude: 51.2, longitude: 6.8 },
  { code: 'mine-plateau-rouge', name: 'Mine du Plateau Rouge', kind: 'mine', city: 'Région nord', country: 'MR', latitude: 22.7, longitude: -12.5 },
  { code: 'mine-cerro-azul', name: 'Mine Cerro Azul (fictive)', kind: 'mine', city: 'Región de Atacama', country: 'CL', latitude: -26.4, longitude: -69.6 },
  { code: 'mine-red-gum', name: 'Red Gum Mine (fictive)', kind: 'mine', city: 'Western Australia', country: 'AU', latitude: -28.7, longitude: 121.4 },
  { code: 'mine-savane', name: 'Mine de la Savane (fictive)', kind: 'mine', city: 'Région centre', country: 'CI', latitude: 7.7, longitude: -5.4 },
  { code: 'mine-ashanti-hills', name: 'Golden Hills Mine (fictive)', kind: 'mine', city: 'Western Region', country: 'GH', latitude: 6.2, longitude: -2.0 },
  { code: 'mine-andes-norte', name: 'Mina Andes Norte (fictive)', kind: 'mine', city: 'Arequipa', country: 'PE', latitude: -15.9, longitude: -71.8 },
  { code: 'mine-desert-amber', name: 'Desert Amber Mine (fictive)', kind: 'mine', city: 'Northern region', country: 'SA', latitude: 26.0, longitude: 43.9 },
] as const;

const PARTNERS = [
  { key: 'alpha', name: 'Transports Alpha', kind: 'carrier', country: 'FR', modes: ['road'], zones: ['europe'], accreditations: 'OEA' },
  { key: 'boreal', name: 'Fret Boréal', kind: 'forwarder', country: 'FR', modes: ['sea', 'air', 'road', 'multimodal'], zones: ['europe', 'africa', 'americas', 'oceania', 'middle_east'], accreditations: 'OEA, FIATA' },
  { key: 'delta', name: 'Delta Lines Maritime', kind: 'carrier', country: 'BE', modes: ['sea'], zones: ['africa', 'americas', 'oceania', 'middle_east'], accreditations: null },
  { key: 'omega', name: 'Aéro Fret Omega', kind: 'forwarder', country: 'FR', modes: ['air', 'express'], zones: ['africa', 'americas', 'oceania', 'middle_east', 'asia'], accreditations: 'IATA' },
  { key: 'sigma', name: 'Express Sigma', kind: 'express', country: 'NL', modes: ['express'], zones: ['europe', 'africa', 'americas', 'oceania', 'asia', 'middle_east'], accreditations: null },
  { key: 'zenith', name: 'Zénith Logistique Projets', kind: 'forwarder', country: 'FR', modes: ['sea', 'road', 'multimodal'], zones: ['europe', 'africa', 'americas', 'oceania'], accreditations: 'OEA' },
  { key: 'gamma', name: 'Emballages Gamma', kind: 'packer', country: 'FR', modes: ['road'], zones: ['europe'], accreditations: 'NIMP 15' },
  { key: 'kappa', name: 'Assurances Kappa', kind: 'insurer', country: 'FR', modes: ['sea', 'air', 'road'], zones: [], accreditations: null },
  { key: 'epsilon', name: 'Douane Epsilon', kind: 'customs_broker', country: 'FR', modes: ['sea', 'air', 'road'], zones: ['europe'], accreditations: 'OEA' },
  { key: 'lambda', name: 'Agent Lambda Afrique', kind: 'agent', country: 'CI', modes: ['road', 'sea'], zones: ['africa'], accreditations: null },
  { key: 'rho', name: 'Transports Rho', kind: 'carrier', country: 'ES', modes: ['road'], zones: ['europe'], accreditations: null, state: 'suspended', stateReason: 'Deux avaries non déclarées en 2026, revue en cours' },
] as const;

type Id = string;

interface PkgSeed {
  type: 'crate' | 'box' | 'pallet' | 'unit' | 'skid' | 'drum';
  l: number; w: number; h: number; gross: number; net: number; desc: string; load?: number; stackable?: boolean; packaging?: string;
  lines: { desc: string; qty: number; hs?: string; origin?: string; value: number; currency?: string; net?: number; part?: string; un?: string; dgClass?: string; pg?: 'I' | 'II' | 'III'; dual?: string }[];
}

interface ShipmentSeed {
  ref: string;
  title: string;
  mode: 'road' | 'sea' | 'air' | 'express' | 'multimodal';
  freight: 'parcel' | 'ltl' | 'ftl' | 'fcl' | 'lcl' | 'breakbulk' | 'air_general';
  incoterm: string;
  place: string;
  from: string;
  to: string;
  pol?: string;
  pod?: string;
  state: 'draft' | 'planned' | 'booked' | 'picked_up' | 'in_transit' | 'arrived' | 'delivered' | 'closed' | 'on_hold' | 'cancelled';
  previous?: 'in_transit' | 'booked';
  reason?: string;
  payment?: 'open_account' | 'letter_of_credit';
  lc?: { number: string; bank: string; latest: number; expiry: number; docs: DocumentKind[] };
  insurance?: 'none' | 'policy' | 'specific' | 'buyer';
  ready?: number; etd?: number; eta?: number; latestEta?: number; picked?: number; atd?: number; ata?: number; delivered?: number;
  podDone?: boolean; validated?: boolean; keystoneRef?: string;
  requests: { ref: string; origin: 'project' | 'purchase_order' | 'spare_part' | 'site_return' | 'other'; title: string; project?: string; costCode?: string; order?: string; needed: number; ready: number; urgency?: 'normal' | 'urgent' | 'critical'; by: string; dg?: 'yes' | 'no' | 'unknown' }[];
  loads?: { type: 'truck' | 'c20' | 'c40' | 'c40hc' | 'open_top' | 'flat_rack' | 'deck' | 'hold' | 'uld'; identifier?: string; seal?: string }[];
  packages: PkgSeed[];
  rfq?: { due: number; sent: number; quotes: { p: string; amount: number; currency?: string; transit: number; valid: number; awarded?: boolean; reason?: string; answeredHours: number }[]; invitedOnly?: string[] };
  booking?: { p: string; number: string; vessel?: string; voyage?: string; master?: string; docsCutoff?: number; cargoCutoff?: number; etd?: number; eta?: number };
  customs?: { procedure: 'export' | 'intra_eu' | 'domestic' | 'temporary_export'; mrn?: string; lodged?: number; exit?: number; exitRef?: string };
  compliance?: Partial<Record<ComplianceCheck, { state: CheckState; detail?: string; reason?: string; evidence?: string }>>;
  docs?: Partial<Record<DocumentKind, { state: DocumentState; number?: string; codex?: string; reason?: string; generated?: boolean }>>;
  milestones?: Partial<Record<MilestoneCode, [number | null, number | null, string?]>>;
  costs?: { cat: 'freight' | 'surcharges' | 'port_handling' | 'customs' | 'insurance' | 'packing' | 'demurrage' | 'duties_taxes'; p?: string; currency?: string; est?: number; quoted?: number; invoiced?: number; invoiceNo?: string; invoiceDay?: number; reconciled?: boolean; reason?: string }[];
  incidents?: { ref: string; type: 'delay' | 'damage' | 'loss' | 'shortage' | 'customs_hold' | 'documents' | 'safety'; severity: 'minor' | 'major' | 'critical'; on: number; place?: string; desc: string; reserves?: boolean; p?: string; claimed?: number; claimCurrency?: string; claimSent?: number; recovered?: number; state: 'open' | 'claimed' | 'settled' | 'rejected' | 'closed'; reason?: string; by: string }[];
}

const crate = (l: number, w: number, h: number, gross: number, desc: string, lines: PkgSeed['lines'], extra: Partial<PkgSeed> = {}): PkgSeed => ({ type: 'crate', l, w, h, gross, net: Math.round(gross * 0.86), desc, lines, packaging: undefined, ...extra });

/** The shipments of the demonstration, from the oldest to the newest. */
export const DEMO_SHIPMENTS: readonly ShipmentSeed[] = [
  {
    ref: 'SH-2026-0101', title: 'Unité mobile UM-3 et pièces — Mine du Plateau Rouge', mode: 'sea', freight: 'breakbulk', incoterm: 'CIF', place: 'Nouakchott',
    from: 'atelier-nord', to: 'mine-plateau-rouge', pol: 'FRLEH', pod: 'MRNKC', state: 'closed', ready: -95, etd: -88, eta: -66, picked: -92, atd: -88, ata: -64, delivered: -58, podDone: true, validated: true,
    insurance: 'policy', keystoneRef: 'EXP-01',
    requests: [{ ref: 'SR-2026-0041', origin: 'project', title: 'Unité mobile UM-3 pour la mine du Plateau Rouge', project: 'DEMO-101', needed: -55, ready: -95, by: 'Sarah Roux', dg: 'no' }],
    loads: [{ type: 'deck' }, { type: 'c40hc', identifier: 'DLMU4100123', seal: 'S-88231' }],
    packages: [
      { type: 'unit', l: 1180, w: 300, h: 350, gross: 26_500, net: 26_500, desc: 'Unité mobile UM-3 sur châssis', load: 1, stackable: false, lines: [{ desc: 'Unité mobile de fabrication UM-3', qty: 1, hs: '84798997', origin: 'FR', value: 1_450_000, net: 26_500 }] },
      crate(380, 220, 210, 6200, 'Caisse 1 — skid de pompage', [{ desc: 'Skid de pompage', qty: 1, hs: '84137035', origin: 'FR', value: 185_000, net: 5300 }], { load: 2 }),
      crate(200, 120, 120, 1450, 'Caisse 2 — pièces de première dotation', [{ desc: 'Kit de pièces de première dotation', qty: 1, hs: '84799070', origin: 'FR', value: 42_000, net: 1200 }], { load: 2 }),
    ],
    rfq: { due: -110, sent: -115, quotes: [{ p: 'boreal', amount: 68_500, transit: 22, valid: -90, awarded: true, answeredHours: 30 }, { p: 'zenith', amount: 72_900, transit: 20, valid: -90, answeredHours: 52 }, { p: 'delta', amount: 61_000, transit: 28, valid: -95, answeredHours: 70, reason: '' }] },
    booking: { p: 'boreal', number: 'BKG-BR-55812', vessel: 'MV Atlas Fictif', voyage: '026S', master: 'DLML-NKC-0412', etd: -88, eta: -66 },
    customs: { procedure: 'export', mrn: '26FRA1234567890AB1', lodged: -90, exit: -88, exitRef: 'DOC-EXA-0101' },
    compliance: { destination: { state: 'ok' }, screening: { state: 'ok', detail: 'Listes UE et ONU, aucun résultat', evidence: 'DOC-CRB-0101' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'checked', codex: 'SHP-DEMO-1001', generated: true }, marks: { state: 'checked', codex: 'SHP-DEMO-1002', generated: true }, proforma_invoice: { state: 'checked', codex: 'SHP-DEMO-1003', generated: true },
      commercial_invoice: { state: 'checked', number: 'FA-26-0912', codex: 'FAC-DEMO-0912' }, shipping_instructions: { state: 'checked', codex: 'SHP-DEMO-1004', generated: true }, bill_of_lading: { state: 'checked', number: 'DLML-NKC-0412', codex: 'SHP-DEMO-1005' },
      export_declaration: { state: 'checked', number: '26FRA1234567890AB1', codex: 'DOC-EXA-0101' }, certificate_of_origin: { state: 'checked', codex: 'SHP-DEMO-1006' }, insurance_certificate: { state: 'checked', codex: 'SHP-DEMO-1007' }, ispm15: { state: 'checked', codex: 'SHP-DEMO-1008' }, pod: { state: 'checked', codex: 'SHP-DEMO-1009' } },
    milestones: { ready: [-95, -95], pickup: [-92, -92], export_cleared: [-90, -90], loaded: [-88, -88], departed: [-88, -88, 'Le Havre'], arrived: [-66, -64, 'Nouakchott'], import_cleared: [-62, -61], delivered: [-58, -58, 'Mine du Plateau Rouge'] },
    costs: [
      { cat: 'freight', p: 'boreal', est: 60_000, quoted: 61_200, invoiced: 61_200, invoiceNo: 'BR-F-26-1180', invoiceDay: -50, reconciled: true },
      { cat: 'port_handling', p: 'boreal', quoted: 4_300, invoiced: 5_150, invoiceNo: 'BR-F-26-1181', invoiceDay: -50, reconciled: true, reason: 'Manutention colis lourd facturée au réel' },
      { cat: 'insurance', p: 'kappa', quoted: 3_000, invoiced: 3_000, invoiceNo: 'KAP-26-332', invoiceDay: -80, reconciled: true },
    ],
    incidents: [{ ref: 'INC-2026-0007', type: 'delay', severity: 'minor', on: -64, place: 'Nouakchott', desc: 'Attente de quai de deux jours à l’arrivée.', state: 'closed', reason: 'Sans conséquence sur la date de besoin', by: 'Hugo Leclerc' }],
  },
  {
    ref: 'SH-2026-0102', title: 'Pièces de rechange — Mine Cerro Azul (urgent)', mode: 'air', freight: 'air_general', incoterm: 'CPT', place: 'Antofagasta',
    from: 'magasin-pieces', to: 'mine-cerro-azul', pol: 'FRCDG', pod: 'CLANF', state: 'delivered', ready: -14, etd: -12, eta: -9, picked: -13, atd: -12, ata: -10, delivered: -8, podDone: true, validated: true,
    requests: [{ ref: 'SR-2026-0058', origin: 'spare_part', title: 'Pompe doseuse de remplacement', costCode: 'SAV-PIECES', order: 'CMD-CL-7781', needed: -9, ready: -14, urgency: 'critical', by: 'Sarah Roux', dg: 'no' }],
    packages: [crate(120, 80, 90, 310, 'Caisse — pompe doseuse', [{ desc: 'Pompe doseuse PD-40', qty: 1, hs: '84138100', origin: 'DE', value: 18_400, net: 260 }], { packaging: 'CAISSE-S' })],
    rfq: { due: -14, sent: -14, quotes: [{ p: 'omega', amount: 6_900, transit: 3, valid: -7, awarded: true, answeredHours: 3 }, { p: 'sigma', amount: 8_400, transit: 2, valid: -7, answeredHours: 2 }] },
    booking: { p: 'omega', number: 'OMG-AWB-77120', master: '057-12345675', etd: -12, eta: -9 },
    customs: { procedure: 'export', mrn: '26FRB7654321098CD2', lodged: -13, exit: -12, exitRef: 'DOC-EXA-0102' },
    compliance: { destination: { state: 'ok' }, screening: { state: 'ok', detail: 'Destinataire déjà criblé (juin 2026)' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'checked', codex: 'SHP-DEMO-1021', generated: true }, marks: { state: 'checked', codex: 'SHP-DEMO-1022', generated: true }, proforma_invoice: { state: 'checked', codex: 'SHP-DEMO-1023', generated: true },
      commercial_invoice: { state: 'received', codex: 'FAC-DEMO-0977' }, shipping_instructions: { state: 'checked', codex: 'SHP-DEMO-1024', generated: true }, air_waybill: { state: 'checked', number: '057-12345675', codex: 'SHP-DEMO-1025' },
      export_declaration: { state: 'checked', number: '26FRB7654321098CD2', codex: 'DOC-EXA-0102' }, eur1: { state: 'checked', codex: 'SHP-DEMO-1026' }, insurance_certificate: { state: 'waived', reason: 'Assurance à la charge de l’acheteur (CPT)' }, ispm15: { state: 'checked', codex: 'SHP-DEMO-1027' }, pod: { state: 'checked', codex: 'SHP-DEMO-1028' } },
    milestones: { pickup: [-13, -13], export_cleared: [-13, -13], departed: [-12, -12, 'Paris CDG'], transshipment: [-11, -11, 'Santiago'], arrived: [-9, -10, 'Antofagasta'], import_cleared: [-9, -9], delivered: [-8, -8] },
    costs: [{ cat: 'freight', p: 'omega', est: 5_200, quoted: 6_900, invoiced: 7_480, invoiceNo: 'OMG-26-4410', invoiceDay: -3, reconciled: false }],
  },
  {
    ref: 'SH-2026-0103', title: 'Module de production MP-2 — Red Gum Mine', mode: 'sea', freight: 'fcl', incoterm: 'DAP', place: 'Red Gum Mine',
    from: 'atelier-sud', to: 'mine-red-gum', pol: 'FRFOS', pod: 'AUFRE', state: 'in_transit', ready: -30, etd: -24, eta: 14, latestEta: 19, picked: -27, atd: -23, validated: true, insurance: 'policy',
    requests: [{ ref: 'SR-2026-0049', origin: 'project', title: 'Module MP-2 et skid d’alimentation', project: 'DEMO-102', needed: 22, ready: -30, by: 'Sarah Roux', dg: 'no' }],
    loads: [{ type: 'flat_rack', identifier: 'DLMU4560987', seal: 'S-90112' }, { type: 'c40hc', identifier: 'DLMU4560990', seal: 'S-90113' }, { type: 'c20', identifier: 'DLMU2200441', seal: 'S-90114' }],
    packages: [
      { type: 'skid', l: 1150, w: 290, h: 250, gross: 18_200, net: 17_600, desc: 'Module MP-2 sur skid', load: 1, stackable: false, lines: [{ desc: 'Module de production MP-2', qty: 1, hs: '84798997', origin: 'FR', value: 920_000, net: 17_600 }] },
      crate(380, 220, 220, 5400, 'Caisse 1 — skid d’alimentation', [{ desc: 'Skid d’alimentation', qty: 1, hs: '84798997', origin: 'FR', value: 140_000, net: 4600 }], { load: 2, packaging: 'CAISSE-L' }),
      crate(200, 120, 120, 1650, 'Caisse 2 — armoire électrique', [{ desc: 'Armoire de commande', qty: 1, hs: '85371098', origin: 'FR', value: 64_000, net: 1400 }], { load: 2, packaging: 'CAISSE-M' }),
      crate(200, 120, 120, 1320, 'Caisse 3 — pièces et outillage', [{ desc: 'Lot de pièces de première dotation', qty: 1, hs: '84799070', origin: 'FR', value: 38_500, net: 1100 }, { desc: 'Outillage de mise en service', qty: 1, hs: '82079099', origin: 'DE', value: 6_200, net: 120 }], { load: 3, packaging: 'CAISSE-M' }),
    ],
    rfq: { due: -45, sent: -50, quotes: [{ p: 'zenith', amount: 54_000, transit: 37, valid: -20, awarded: true, answeredHours: 26 }, { p: 'boreal', amount: 57_400, transit: 35, valid: -20, answeredHours: 40 }, { p: 'delta', amount: 51_500, transit: 44, valid: -25, answeredHours: 96 }] },
    booking: { p: 'zenith', number: 'ZEN-BK-30982', vessel: 'MV Horizon Fictif', voyage: '118E', master: 'DLML-FRE-1186', etd: -24, eta: 14 },
    customs: { procedure: 'export', mrn: '26FRC1122334455EF3', lodged: -25, exit: -23, exitRef: 'DOC-EXA-0103' },
    compliance: { destination: { state: 'ok' }, screening: { state: 'ok', detail: 'Client direct, criblé en septembre 2026' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'checked', codex: 'SHP-DEMO-1031', generated: true }, marks: { state: 'checked', codex: 'SHP-DEMO-1032', generated: true }, proforma_invoice: { state: 'checked', codex: 'SHP-DEMO-1033', generated: true },
      commercial_invoice: { state: 'checked', codex: 'FAC-DEMO-1001' }, shipping_instructions: { state: 'checked', codex: 'SHP-DEMO-1034', generated: true }, bill_of_lading: { state: 'received', number: 'DLML-FRE-1186', codex: 'SHP-DEMO-1035' },
      vgm: { state: 'checked', codex: 'SHP-DEMO-1036', generated: true }, export_declaration: { state: 'checked', number: '26FRC1122334455EF3', codex: 'DOC-EXA-0103' }, certificate_of_origin: { state: 'checked', codex: 'SHP-DEMO-1037' }, insurance_certificate: { state: 'checked', codex: 'SHP-DEMO-1038' }, ispm15: { state: 'checked', codex: 'SHP-DEMO-1039' } },
    milestones: { pickup: [-27, -27], gate_in: [-25, -25, 'Fos-sur-Mer'], export_cleared: [-25, -25], loaded: [-24, -23], departed: [-24, -23, 'Fos-sur-Mer'], transshipment: [-2, -1, 'Port Louis'], arrived: [14, null, 'Fremantle'], import_cleared: [16, null], delivered: [21, null, 'Red Gum Mine'] },
    costs: [{ cat: 'freight', p: 'zenith', est: 50_000, quoted: 54_000 }, { cat: 'insurance', p: 'kappa', quoted: 2_600 }, { cat: 'packing', p: 'gamma', quoted: 4_900, invoiced: 4_900, invoiceNo: 'GAM-26-118', invoiceDay: -26, reconciled: true }],
    incidents: [{ ref: 'INC-2026-0011', type: 'delay', severity: 'major', on: -2, place: 'Port Louis', desc: 'Transbordement décalé : nouvelle ETA à Fremantle annoncée à +5 jours.', p: 'zenith', state: 'open', by: 'Hugo Leclerc' }],
  },
  {
    ref: 'SH-2026-0104', title: 'Équipements de site — Mine de la Savane', mode: 'sea', freight: 'fcl', incoterm: 'CIF', place: 'Abidjan',
    from: 'atelier-nord', to: 'mine-savane', pol: 'FRLEH', pod: 'CIABJ', state: 'booked', ready: 2, etd: 6, eta: 20, validated: true, insurance: 'policy',
    payment: 'letter_of_credit', lc: { number: 'LC-DEMO-2026-118', bank: 'Banque Fictive du Commerce', latest: 10, expiry: 40, docs: ['commercial_invoice', 'bill_of_lading', 'certificate_of_origin', 'insurance_certificate', 'packing_list'] },
    requests: [{ ref: 'SR-2026-0061', origin: 'project', title: 'Conteneurs d’équipements de site', project: 'DEMO-104', needed: 28, ready: 2, by: 'Sarah Roux', dg: 'yes' }],
    loads: [{ type: 'c40hc', identifier: 'DLMU4771201' }, { type: 'c20', identifier: 'DLMU2290331' }],
    packages: [
      crate(380, 220, 220, 4100, 'Caisse 1 — container de stockage équipé', [{ desc: 'Module de stockage équipé', qty: 1, hs: '94069090', origin: 'FR', value: 72_000, net: 3500 }], { load: 1, packaging: 'CAISSE-L' }),
      crate(200, 120, 120, 980, 'Caisse 2 — groupe électrogène', [{ desc: 'Groupe électrogène 60 kVA', qty: 1, hs: '85021120', origin: 'IT', value: 21_500, net: 850 }], { load: 1, packaging: 'CAISSE-M' }),
      { type: 'drum', l: 60, w: 60, h: 90, gross: 230, net: 200, desc: 'Fûts — additif de procédé', load: 2, lines: [{ desc: 'Additif liquide de procédé (fûts de 200 l)', qty: 4, hs: '38249992', origin: 'FR', value: 380, net: 200, un: 'UN1993', dgClass: '3', pg: 'III' }] },
    ],
    rfq: { due: -10, sent: -16, quotes: [{ p: 'boreal', amount: 14_800, transit: 14, valid: 15, awarded: true, answeredHours: 20 }, { p: 'zenith', amount: 15_600, transit: 13, valid: 15, answeredHours: 31 }, { p: 'delta', amount: 13_900, transit: 18, valid: -2, answeredHours: 60 }] },
    booking: { p: 'boreal', number: 'BKG-BR-61240', vessel: 'MV Lagune Fictif', voyage: '044S', docsCutoff: 1, cargoCutoff: 3, etd: 6, eta: 20 },
    customs: { procedure: 'export' },
    compliance: { destination: { state: 'ok' }, screening: { state: 'ok', detail: 'Filiale du groupe, destinataire connu' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'ok', detail: 'Déclaration IMDG signée par un déclarant habilité' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'checked', codex: 'SHP-DEMO-1041', generated: true }, marks: { state: 'received', codex: 'SHP-DEMO-1042', generated: true }, proforma_invoice: { state: 'checked', codex: 'SHP-DEMO-1043', generated: true },
      shipping_instructions: { state: 'checked', codex: 'SHP-DEMO-1044', generated: true }, dg_declaration: { state: 'checked', codex: 'SHP-DEMO-1045' }, sds: { state: 'checked', codex: 'FDS-DEMO-0012' }, insurance_certificate: { state: 'expected' }, ispm15: { state: 'expected' }, certificate_of_origin: { state: 'expected' } },
    milestones: { ready: [2, null], pickup: [3, null], gate_in: [4, null, 'Le Havre'], export_cleared: [5, null], departed: [6, null, 'Le Havre'], arrived: [20, null, 'Abidjan'], delivered: [26, null, 'Mine de la Savane'] },
    costs: [{ cat: 'freight', p: 'boreal', est: 13_000, quoted: 14_800 }, { cat: 'insurance', p: 'kappa', quoted: 900 }],
  },
  {
    ref: 'SH-2026-0105', title: 'Cuves et tuyauterie — Mina Andes Norte', mode: 'sea', freight: 'lcl', incoterm: 'FCA', place: 'Le Havre',
    from: 'atelier-nord', to: 'mine-andes-norte', pol: 'FRLEH', pod: 'PEMRI', state: 'planned', ready: 9, etd: 15, validated: true, insurance: 'buyer',
    requests: [{ ref: 'SR-2026-0064', origin: 'project', title: 'Cuves de stockage et tuyauterie', project: 'DEMO-102', needed: 60, ready: 9, by: 'Sarah Roux', dg: 'no' }],
    packages: [
      crate(380, 220, 220, 2900, 'Caisse 1 — cuve 10 m³', [{ desc: 'Cuve inox 10 m³', qty: 1, hs: '73090059', origin: 'FR', value: 34_000, net: 2400 }], { packaging: 'CAISSE-L' }),
      { type: 'pallet', l: 120, w: 80, h: 110, gross: 640, net: 610, desc: 'Palette — tuyauterie et brides', packaging: 'PAL-EUR', lines: [{ desc: 'Tuyauterie inox et brides', qty: 1, hs: '73072100', origin: 'FR', value: 9_800, net: 610 }] },
    ],
    rfq: { due: 2, sent: -3, quotes: [{ p: 'boreal', amount: 3_950, transit: 38, valid: 20, answeredHours: 22 }, { p: 'zenith', amount: 4_380, transit: 33, valid: 25, answeredHours: 47 }], invitedOnly: ['delta'] },
    customs: { procedure: 'export' },
    compliance: { destination: { state: 'ok' }, screening: { state: 'pending' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'received', codex: 'SHP-DEMO-1051', generated: true } },
    costs: [{ cat: 'freight', est: 3_600 }],
  },
  {
    ref: 'SH-2026-0106', title: 'Kit capteurs et automate — Golden Hills Mine', mode: 'express', freight: 'parcel', incoterm: 'DAP', place: 'Golden Hills Mine',
    from: 'magasin-pieces', to: 'mine-ashanti-hills', state: 'draft', ready: 1,
    requests: [{ ref: 'SR-2026-0066', origin: 'spare_part', title: 'Capteurs de niveau et carte automate', costCode: 'SAV-PIECES', order: 'CMD-GH-2207', needed: 5, ready: 1, urgency: 'urgent', by: 'Sarah Roux', dg: 'unknown' }],
    packages: [{ type: 'box', l: 60, w: 40, h: 40, gross: 18, net: 14, desc: 'Carton — capteurs et carte', packaging: 'CARTON-50', lines: [{ desc: 'Capteur de niveau radar', qty: 3, hs: '90261029', origin: 'DE', value: 1_250, net: 9 }, { desc: 'Carte d’entrées / sorties automate', qty: 1, hs: '85389099', origin: 'FR', value: 2_100, net: 1 }, { desc: 'Batterie lithium de sauvegarde', qty: 2, hs: '85065010', origin: 'CN', value: 45, net: 0.2, un: 'UN3091', dgClass: '9', pg: 'II' }] }],
  },
  {
    ref: 'SH-2026-0107', title: 'Vérins hydrauliques — enlèvement Fournisseur Orion', mode: 'road', freight: 'ltl', incoterm: 'FCA', place: 'Fournisseur Orion',
    from: 'fournisseur-orion', to: 'atelier-nord', state: 'picked_up', ready: -2, etd: -1, eta: 1, picked: -1, validated: true, insurance: 'policy',
    requests: [{ ref: 'SR-2026-0063', origin: 'purchase_order', title: 'Vérins hydrauliques de la commande d’achat', project: 'DEMO-104', order: 'CA-26-04412', needed: 3, ready: -2, by: 'Sarah Roux', dg: 'no' }],
    loads: [{ type: 'truck', identifier: 'GR-123-DE' }],
    packages: [{ type: 'pallet', l: 120, w: 80, h: 95, gross: 740, net: 715, desc: 'Palette 1 — vérins', packaging: 'PAL-EUR', lines: [{ desc: 'Vérin hydraulique VH-200', qty: 6, hs: '84122120', origin: 'DE', value: 1_900, net: 715 }] }, { type: 'pallet', l: 120, w: 80, h: 80, gross: 410, net: 390, desc: 'Palette 2 — flexibles', packaging: 'PAL-EUR', lines: [{ desc: 'Flexibles hydrauliques', qty: 40, hs: '40093100', origin: 'DE', value: 85, net: 390 }] }],
    rfq: { due: -8, sent: -10, quotes: [{ p: 'alpha', amount: 690, transit: 2, valid: 10, awarded: true, answeredHours: 4 }, { p: 'boreal', amount: 820, transit: 2, valid: 10, answeredHours: 8 }] },
    booking: { p: 'alpha', number: 'ALP-26-88340', etd: -1, eta: 1 },
    customs: { procedure: 'intra_eu' },
    compliance: { destination: { state: 'na' }, screening: { state: 'na' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'received', codex: 'SHP-DEMO-1071' }, marks: { state: 'received', codex: 'SHP-DEMO-1072' }, cmr: { state: 'received', number: 'CMR-0045512', codex: 'SHP-DEMO-1073', generated: true } },
    milestones: { pickup: [-1, -1, 'Fournisseur Orion'], departed: [-1, -1], arrived: [1, null], delivered: [1, null, 'Atelier Nord'] },
    costs: [{ cat: 'freight', p: 'alpha', est: 610, quoted: 690 }],
  },
  {
    ref: 'SH-2026-0108', title: 'Retour de site — pompe en réparation', mode: 'sea', freight: 'lcl', incoterm: 'EXW', place: 'Mine du Plateau Rouge',
    from: 'mine-plateau-rouge', to: 'atelier-sud', pol: 'MRNKC', pod: 'FRFOS', state: 'on_hold', previous: 'in_transit', reason: 'Blocage en douane à l’importation : déclaration de perfectionnement passif à compléter', ready: -40, etd: -33, eta: -12, latestEta: 4, picked: -36, atd: -33, validated: true, insurance: 'policy',
    requests: [{ ref: 'SR-2026-0052', origin: 'site_return', title: 'Retour de la pompe de transfert pour réparation', costCode: 'ATELIER-RETOUR', needed: -5, ready: -40, by: 'Sarah Roux', dg: 'no' }],
    packages: [crate(200, 120, 120, 1120, 'Caisse — pompe de transfert', [{ desc: 'Pompe de transfert (retour réparation)', qty: 1, hs: '84137035', origin: 'FR', value: 12_000, net: 960 }], { packaging: 'CAISSE-M' })],
    rfq: { due: -45, sent: -48, quotes: [{ p: 'boreal', amount: 2_350, transit: 21, valid: -30, awarded: true, answeredHours: 28 }] },
    booking: { p: 'boreal', number: 'BKG-BR-58771', vessel: 'MV Atlas Fictif', voyage: '031N', etd: -33, eta: -12 },
    customs: { procedure: 'outward_processing' as never },
    compliance: { destination: { state: 'na' }, screening: { state: 'na' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'checked', codex: 'SHP-DEMO-1081', generated: true }, bill_of_lading: { state: 'received', number: 'DLML-FOS-0377', codex: 'SHP-DEMO-1082' } },
    milestones: { pickup: [-36, -36], departed: [-33, -33, 'Nouakchott'], arrived: [-12, -11, 'Fos-sur-Mer'], import_cleared: [-10, null], delivered: [-5, null, 'Atelier Sud'] },
    costs: [{ cat: 'freight', p: 'boreal', quoted: 2_350, invoiced: 2_350, invoiceNo: 'BR-F-26-1302', invoiceDay: -20 }, { cat: 'demurrage', p: 'boreal', est: 600 }],
    incidents: [{ ref: 'INC-2026-0012', type: 'customs_hold', severity: 'major', on: -10, place: 'Fos-sur-Mer', desc: 'Marchandise retenue : régime de perfectionnement passif non déclaré au départ.', p: 'epsilon', state: 'open', by: 'Nadia Brun' }],
  },
  {
    ref: 'SH-2026-0109', title: 'Analyseurs de laboratoire — Desert Amber Mine', mode: 'air', freight: 'air_general', incoterm: 'CIP', place: 'Riyadh',
    from: 'atelier-nord', to: 'mine-desert-amber', pol: 'FRCDG', pod: 'SARUH', state: 'planned', ready: 6, etd: 10, validated: false, insurance: 'policy',
    requests: [{ ref: 'SR-2026-0065', origin: 'project', title: 'Analyseurs du laboratoire de site', project: 'DEMO-105', needed: 18, ready: 6, by: 'Sarah Roux', dg: 'no' }],
    packages: [crate(120, 80, 90, 260, 'Caisse 1 — analyseur', [{ desc: 'Analyseur de densité', qty: 1, hs: '90278990', origin: 'CH', value: 48_000, net: 210, dual: '3A999' }], { packaging: 'CAISSE-S' }), crate(120, 80, 80, 190, 'Caisse 2 — consommables', [{ desc: 'Consommables de laboratoire', qty: 1, hs: '70179000', origin: 'DE', value: 3_200, net: 150 }], { packaging: 'CAISSE-S' })],
    rfq: { due: 3, sent: -1, quotes: [{ p: 'omega', amount: 3_400, transit: 2, valid: 12, answeredHours: 18 }], invitedOnly: ['sigma', 'boreal'] },
    customs: { procedure: 'export' },
    compliance: { destination: { state: 'pending', detail: 'Pays sous surveillance : vérifier l’utilisateur final' }, screening: { state: 'pending' }, dual_use: { state: 'blocked', detail: 'Numéro de contrôle 3A999 : licence à obtenir' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    costs: [{ cat: 'freight', est: 2_900 }],
  },
  {
    ref: 'SH-2026-0110', title: 'Transfert interne — moules et gabarits', mode: 'road', freight: 'ftl', incoterm: 'DAP', place: 'Atelier Sud',
    from: 'atelier-nord', to: 'atelier-sud', state: 'arrived', ready: -6, etd: -4, eta: -3, picked: -4, atd: -4, ata: -3, validated: true, insurance: 'policy',
    requests: [{ ref: 'SR-2026-0060', origin: 'other', title: 'Transfert des moules vers l’Atelier Sud', costCode: 'ATELIER-TRANSFERT', needed: -2, ready: -6, by: 'Sarah Roux', dg: 'no' }],
    loads: [{ type: 'truck', identifier: 'AB-456-CD' }],
    packages: [crate(380, 220, 210, 7600, 'Caisse — moules', [{ desc: 'Moules et gabarits', qty: 4, hs: '84807100', origin: 'FR', value: 9_000, net: 6500 }], { packaging: 'CAISSE-L' })],
    rfq: { due: -12, sent: -13, quotes: [{ p: 'alpha', amount: 1_480, transit: 1, valid: 5, awarded: true, answeredHours: 6 }, { p: 'zenith', amount: 1_620, transit: 1, valid: 5, answeredHours: 12 }] },
    booking: { p: 'alpha', number: 'ALP-26-88102', etd: -4, eta: -3 },
    customs: { procedure: 'domestic' },
    compliance: { destination: { state: 'na' }, screening: { state: 'na' }, dual_use: { state: 'na' }, dangerous_goods: { state: 'na' }, end_use: { state: 'na' } },
    docs: { packing_list: { state: 'checked', codex: 'SHP-DEMO-1101', generated: true }, marks: { state: 'checked', codex: 'SHP-DEMO-1102', generated: true } },
    milestones: { pickup: [-4, -4], departed: [-4, -4], arrived: [-3, -3, 'Atelier Sud'], delivered: [-3, null] },
    costs: [{ cat: 'freight', p: 'alpha', est: 1_400, quoted: 1_480, invoiced: 1_480, invoiceNo: 'ALP-F-26-9921', invoiceDay: -1, reconciled: false }],
    incidents: [{ ref: 'INC-2026-0013', type: 'damage', severity: 'minor', on: -3, place: 'Atelier Sud', desc: 'Caisse enfoncée sur un angle, contenu à vérifier.', reserves: true, p: 'alpha', claimed: 450, claimCurrency: 'EUR', claimSent: -2, state: 'claimed', by: 'Léo Martin' }],
  },
  {
    ref: 'SH-2026-0111', title: 'Seconde unité mobile UM-4 — Mine Cerro Azul', mode: 'sea', freight: 'breakbulk', incoterm: 'DAP', place: 'Mine Cerro Azul',
    from: 'atelier-nord', to: 'mine-cerro-azul', pol: 'FRLEH', pod: 'CLANF', state: 'cancelled', reason: 'Projet décalé au premier semestre 2027 par le client', ready: 20,
    requests: [{ ref: 'SR-2026-0057', origin: 'project', title: 'Unité mobile UM-4', project: 'DEMO-103', needed: 70, ready: 20, by: 'Sarah Roux', dg: 'no' }],
    packages: [{ type: 'unit', l: 1180, w: 300, h: 350, gross: 26_800, net: 26_800, desc: 'Unité mobile UM-4', stackable: false, lines: [{ desc: 'Unité mobile de fabrication UM-4', qty: 1, hs: '84798997', origin: 'FR', value: 1_480_000, net: 26_800 }] }],
  },
];

/** Requests not yet in a shipment (the triage list of the shipping manager). */
const OPEN_REQUESTS = [
  { ref: 'SR-2026-0067', origin: 'project' as const, title: 'Pièces de mise en service — Red Gum Mine', project: 'DEMO-102', from: 'atelier-sud', to: 'mine-red-gum', fromCountry: 'FR', toCountry: 'AU', ready: 12, needed: 35, urgency: 'normal' as const, kg: 850, m3: 3.2, value: 44_000, dg: 'no' as const, state: 'submitted' as const, desc: 'Trois caisses de pièces pour la mise en service du module MP-2.' },
  { ref: 'SR-2026-0068', origin: 'spare_part' as const, title: 'Joints et filtres — Mine de la Savane', costCode: 'SAV-PIECES', order: 'CMD-CI-1180', from: 'magasin-pieces', to: 'mine-savane', fromCountry: 'FR', toCountry: 'CI', ready: 1, needed: 9, urgency: 'urgent' as const, kg: 42, m3: 0.15, value: 3_800, dg: 'no' as const, state: 'submitted' as const, desc: 'Lot de joints et de filtres de rechange, à grouper avec SH-2026-0104 si possible.' },
  { ref: 'SR-2026-0069', origin: 'project' as const, title: 'Matériel pour un site au Kazakhstan', project: 'DEMO-106', from: 'atelier-nord', to: null, toAddress: 'Site minier fictif, région d’Aktobe', fromCountry: 'FR', toCountry: 'KZ', ready: 30, needed: 75, urgency: 'normal' as const, kg: 12_000, m3: 60, value: 610_000, dg: 'unknown' as const, state: 'submitted' as const, desc: 'Équipements d’une unité de production ; destination restreinte : contrôle de conformité à prévoir.' },
  { ref: 'SR-2026-0070', origin: 'site_return' as const, title: 'Retour d’outillage de mise en service', costCode: 'ATELIER-RETOUR', from: 'mine-plateau-rouge', to: 'atelier-nord', fromCountry: 'MR', toCountry: 'FR', ready: 15, needed: 60, urgency: 'normal' as const, kg: 300, m3: 1.5, value: 8_000, dg: 'no' as const, state: 'draft' as const, desc: 'Caisse d’outillage à rapatrier après la mise en service.' },
  { ref: 'SR-2026-0059', origin: 'other' as const, title: 'Échantillons pour un salon', costCode: 'COM-SALON', from: 'atelier-nord', to: null, toAddress: 'Parc des expositions, Ville-Est', fromCountry: 'FR', toCountry: 'DE', ready: -20, needed: -10, urgency: 'normal' as const, kg: 60, m3: 0.4, value: 500, dg: 'no' as const, state: 'rejected' as const, reason: 'Transport organisé par le salon', desc: 'Deux cartons d’échantillons.' },
];

export async function seedDemo(tx: Tx): Promise<void> {
  const userIds = new Map<string, Id>();
  for (const p of DEMO_PERSONAS) {
    const [u] = await tx.insert(users).values({ email: p.email, name: p.name }).returning({ id: users.id });
    userIds.set(p.name, u.id);
  }
  const managerId = userIds.get('Élise Garnier')!;
  const coordinator = { id: userIds.get('Hugo Leclerc')!, name: 'Hugo Leclerc' };

  await tx.insert(sites).values(DEMO_SITES.map((s) => ({ ...s, source: 'demo' as const })));
  const partnerIds = new Map<string, Id>();
  for (const p of PARTNERS) {
    const [row] = await tx.insert(partners).values({
      name: p.name, kind: p.kind, country: p.country, modes: [...p.modes], zones: [...p.zones], accreditations: p.accreditations,
      contactRole: 'Service exploitation', contactEmail: `exploitation@${p.key}.example`, contactPhone: '+00 0 00 00 00 00',
      state: 'state' in p ? p.state : 'active', stateReason: 'stateReason' in p ? p.stateReason : null,
    }).returning({ id: partners.id });
    partnerIds.set(p.key, row.id);
  }
  await tx.insert(hsCodes).values([
    { code: '84798997', description: 'Machines et appareils mécaniques ayant une fonction propre, n.d.a.', validated: true },
    { code: '84137035', description: 'Pompes centrifuges', validated: true },
    { code: '84799070', description: 'Parties de machines du 8479', validated: true },
    { code: '85371098', description: 'Tableaux et armoires de commande électrique ≤ 1 000 V', validated: true },
    { code: '84138100', description: 'Pompes pour liquides, autres', validated: true },
    { code: '90278990', description: 'Instruments d’analyse physique ou chimique', dualUseCode: '3A999', validated: false },
    { code: '38249992', description: 'Préparations chimiques liquides, n.d.a.', validated: true },
    { code: '85065010', description: 'Piles et batteries au lithium', validated: true },
  ]);
  await tx.insert(exchangeRates).values([
    { currency: 'USD', on: d(-30), perEur: 1.082 }, { currency: 'USD', on: d(-3), perEur: 1.071 },
    { currency: 'AUD', on: d(-3), perEur: 1.648 }, { currency: 'CLP', on: d(-3), perEur: 1012.5 }, { currency: 'ZAR', on: d(-3), perEur: 19.62 }, { currency: 'XOF', on: d(-3), perEur: 655.957 },
  ]);

  const site = (code: string) => DEMO_SITES.find((s) => s.code === code)!;
  const requestIds = new Map<string, Id>();
  const requester = { id: userIds.get('Sarah Roux')!, name: 'Sarah Roux' };

  for (const s of DEMO_SHIPMENTS) {
    const from = site(s.from), to = site(s.to);
    const [sh] = await tx.insert(shipments).values({
      ref: s.ref, title: s.title, mode: s.mode, freightType: s.freight, incoterm: s.incoterm, incotermPlace: s.place,
      fromSite: from.code, fromCountry: from.country, toSite: to.code, toCountry: to.country, portOfLoading: s.pol ?? null, portOfDischarge: s.pod ?? null,
      coordinatorId: coordinator.id, coordinatorName: coordinator.name, payment: s.payment ?? 'open_account',
      lcNumber: s.lc?.number ?? null, lcBank: s.lc?.bank ?? null, lcLatestShipment: s.lc ? d(s.lc.latest) : null, lcExpiry: s.lc ? d(s.lc.expiry) : null, lcDocuments: s.lc?.docs ?? [],
      insurance: s.insurance ?? 'policy', readyOn: s.ready != null ? d(s.ready) : null, etd: s.etd != null ? d(s.etd) : null, eta: s.eta != null ? d(s.eta) : null,
      latestEta: s.latestEta != null ? d(s.latestEta) : null, pickedUpOn: s.picked != null ? d(s.picked) : null, atd: s.atd != null ? d(s.atd) : null, ata: s.ata != null ? d(s.ata) : null,
      deliveredOn: s.delivered != null ? d(s.delivered) : null, podSignedBy: s.podDone ? 'Responsable magasin du site' : null, podCodexRef: s.podDone ? `POD-DEMO-${s.ref.slice(-4)}` : null,
      packingValidatedAt: s.validated ? at((s.ready ?? 0) - 1) : null, state: s.state, previousState: s.previous ?? null, stateReason: s.reason ?? null, keystoneRef: s.keystoneRef ?? null,
      createdAt: at((s.ready ?? 0) - 20), updatedAt: at(Math.min(0, (s.ready ?? 0) + 5)),
    }).returning({ id: shipments.id });

    for (const r of s.requests) {
      const [req] = await tx.insert(shipmentRequests).values({
        ref: r.ref, origin: r.origin, title: r.title, projectCode: r.project ?? null, costCode: r.costCode ?? null, orderRef: r.order ?? null,
        fromSite: from.code, fromCountry: from.country, toSite: to.code, toCountry: to.country, readyOn: d(r.ready), neededOn: d(r.needed), urgency: r.urgency ?? 'normal',
        description: r.title, dangerousGoods: r.dg ?? 'unknown', incoterm: s.incoterm, incotermPlace: s.place, state: 'accepted', requestedById: requester.id, requestedByName: r.by,
        submittedAt: at(r.ready - 21), createdAt: at(r.ready - 22),
      }).returning({ id: shipmentRequests.id });
      requestIds.set(r.ref, req.id);
      await tx.insert(shipmentAllocations).values({ shipmentId: sh.id, requestId: req.id });
    }

    const loadIds: Id[] = [];
    for (const [i, l] of (s.loads ?? []).entries()) {
      const [row] = await tx.insert(loads).values({ shipmentId: sh.id, number: i + 1, type: l.type, identifier: l.identifier ?? null, seal: l.seal ?? null }).returning({ id: loads.id });
      loadIds.push(row.id);
    }
    for (const [i, p] of s.packages.entries()) {
      const [pk] = await tx.insert(packages).values({
        shipmentId: sh.id, loadId: p.load ? loadIds[p.load - 1] ?? null : null, number: i + 1, type: p.type, lengthCm: p.l, widthCm: p.w, heightCm: p.h, grossKg: p.gross, netKg: p.net,
        stackable: p.stackable ?? true, packagingCode: p.packaging ?? null, description: p.desc,
      }).returning({ id: packages.id });
      await tx.insert(packageLines).values(p.lines.map((l) => ({
        packageId: pk.id, partRef: l.part ?? null, description: l.desc, quantity: l.qty, hsCode: l.hs ?? null, originCountry: l.origin ?? null, unitValue: l.value, currency: l.currency ?? 'EUR',
        netKg: l.net ?? null, dualUseCode: l.dual ?? null, unNumber: l.un ?? null, dgClass: l.dgClass ?? null, dgPackingGroup: l.pg ?? null,
      })));
    }

    if (s.rfq) {
      const [rfq] = await tx.insert(rfqs).values({ ref: `RFQ-2026-${s.ref.slice(-4)}`, shipmentId: sh.id, dueOn: d(s.rfq.due), state: s.rfq.quotes.some((q) => q.awarded) ? 'closed' : 'sent', sentAt: at(s.rfq.sent) }).returning({ id: rfqs.id });
      for (const q of s.rfq.quotes) {
        const pid = partnerIds.get(q.p)!;
        const received = new Date(at(s.rfq.sent).getTime() + q.answeredHours * 3_600_000);
        await tx.insert(rfqInvitations).values({ rfqId: rfq.id, partnerId: pid, invitedAt: at(s.rfq.sent), answeredAt: received });
        await tx.insert(quotes).values({
          rfqId: rfq.id, partnerId: pid, amount: q.amount, currency: q.currency ?? 'EUR', transitDays: q.transit, validUntil: d(q.valid), receivedAt: received,
          breakdown: { freight: Math.round(q.amount * 0.8), surcharges: Math.round(q.amount * 0.12), port_handling: q.amount - Math.round(q.amount * 0.8) - Math.round(q.amount * 0.12) },
          state: q.awarded ? 'awarded' : s.rfq.quotes.some((x) => x.awarded) ? 'declined' : q.valid < 0 ? 'expired' : 'received',
          awardReason: q.awarded ? q.reason ?? (s.rfq.quotes.every((x) => x.amount >= q.amount) ? null : 'Délai de transit plus court et départ plus tôt') : null,
          awardedAt: q.awarded ? at(s.rfq.due) : null, awardedByName: q.awarded ? 'Élise Garnier' : null,
        });
      }
      for (const p of s.rfq.invitedOnly ?? []) await tx.insert(rfqInvitations).values({ rfqId: rfq.id, partnerId: partnerIds.get(p)!, invitedAt: at(s.rfq.sent) });
    }
    if (s.booking) {
      const b = s.booking;
      await tx.insert(bookings).values({
        shipmentId: sh.id, partnerId: partnerIds.get(b.p)!, number: b.number, vessel: b.vessel ?? null, voyage: b.voyage ?? null, masterDocument: b.master ?? null,
        docsCutoff: b.docsCutoff != null ? at(b.docsCutoff, 12) : null, cargoCutoff: b.cargoCutoff != null ? at(b.cargoCutoff, 16) : null, etd: b.etd != null ? d(b.etd) : null, eta: b.eta != null ? d(b.eta) : null,
      });
    }
    if (s.customs) {
      const c = s.customs;
      await tx.insert(customsDeclarations).values({ shipmentId: sh.id, procedure: c.procedure, declarantId: partnerIds.get('epsilon')!, mrn: c.mrn ?? null, lodgedOn: c.lodged != null ? d(c.lodged) : null, exitOn: c.exit != null ? d(c.exit) : null, exitCodexRef: c.exitRef ?? null });
    }
    for (const [check, c] of Object.entries(s.compliance ?? {})) {
      await tx.insert(complianceChecks).values({ shipmentId: sh.id, check, state: c!.state, detail: c!.detail ?? null, reason: c!.reason ?? null, evidenceCodexRef: c!.evidence ?? null, byName: c!.state === 'pending' ? null : 'Nadia Brun', at: c!.state === 'pending' ? null : at((s.ready ?? 0) - 5) });
    }
    for (const [kind, doc] of Object.entries(s.docs ?? {})) {
      await tx.insert(shipmentDocuments).values({ shipmentId: sh.id, kind, state: doc!.state, number: doc!.number ?? null, codexRef: doc!.codex ?? null, generated: !!doc!.generated, reason: doc!.reason ?? null, updatedByName: coordinator.name, updatedAt: at((s.ready ?? 0) - 2) });
    }
    for (const [code, [p, a, place]] of Object.entries(s.milestones ?? {}) as [MilestoneCode, [number | null, number | null, string?]][]) {
      await tx.insert(milestones).values({ shipmentId: sh.id, code, plannedOn: p != null ? d(p) : null, actualOn: a != null ? d(a) : null, place: place ?? null });
    }
    for (const c of s.costs ?? []) {
      await tx.insert(costLines).values({
        shipmentId: sh.id, category: c.cat, partnerId: c.p ? partnerIds.get(c.p)! : null, currency: c.currency ?? 'EUR', estimated: c.est ?? null, quoted: c.quoted ?? null,
        invoiced: c.invoiced ?? null, invoiceNumber: c.invoiceNo ?? null, invoiceDate: c.invoiceDay != null ? d(c.invoiceDay) : null, reconciled: !!c.reconciled, varianceReason: c.reason ?? null,
        source: c.invoiced != null ? 'sage' : c.quoted != null ? 'quote' : 'estimate',
      });
    }
    for (const i of s.incidents ?? []) {
      await tx.insert(incidents).values({
        ref: i.ref, shipmentId: sh.id, type: i.type, severity: i.severity, occurredOn: d(i.on), place: i.place ?? null, description: i.desc, reservesWritten: !!i.reserves,
        partnerId: i.p ? partnerIds.get(i.p)! : null, claimedAmount: i.claimed ?? null, claimCurrency: i.claimCurrency ?? null, claimSentOn: i.claimSent != null ? d(i.claimSent) : null,
        recoveredAmount: i.recovered ?? null, state: i.state, stateReason: i.reason ?? null, reportedByName: i.by,
      });
    }
  }

  for (const r of OPEN_REQUESTS) {
    await tx.insert(shipmentRequests).values({
      ref: r.ref, origin: r.origin, title: r.title, projectCode: 'project' in r ? r.project : null, costCode: 'costCode' in r ? r.costCode : null, orderRef: 'order' in r ? r.order : null,
      fromSite: r.from, fromCountry: r.fromCountry, toSite: r.to, toAddress: 'toAddress' in r ? r.toAddress : null, toCountry: r.toCountry, readyOn: d(r.ready), neededOn: d(r.needed),
      urgency: r.urgency, description: r.desc, estimatedKg: r.kg, estimatedM3: r.m3, estimatedValueEur: r.value, dangerousGoods: r.dg, state: r.state,
      stateReason: 'reason' in r ? r.reason : null, requestedById: requester.id, requestedByName: requester.name, submittedAt: r.state === 'draft' ? null : at(-2), createdAt: at(-3),
    });
  }

  // One deposit waiting in the Codex outbox (simulated connector), and one notice to Vigie (dangerous goods on SH-2026-0104).
  await tx.insert(outbox).values([
    { target: 'codex', kind: 'deposit_document', payload: { shipment: 'SH-2026-0104', kind: 'marks', title: 'Marques de colis SH-2026-0104' } },
    { target: 'vigie', kind: 'dangerous_goods_notice', payload: { shipment: 'SH-2026-0104', un: ['UN1993'], departure: d(6) } },
  ]);

  await tx.insert(counters).values([
    { prefix: 'SR', year: 2026, value: 70 }, { prefix: 'SH', year: 2026, value: 111 }, { prefix: 'RFQ', year: 2026, value: 111 }, { prefix: 'INC', year: 2026, value: 13 },
  ]);
  void managerId;
}
