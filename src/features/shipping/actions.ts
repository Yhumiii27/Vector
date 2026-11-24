'use server';
// Server Functions of Vector (docs/spec/01–04). Each one validates its input and the viewer's right server-side, re-reads what it
// changes inside its transaction (the shipment through the visibility rule), applies the pure rules of src/domain again, writes
// and records the audit row in the same transaction, then revalidates the pages.
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { complianceCleared, waiverBlockers } from '@/domain/compliance';
import { rateOn } from '@/domain/costs';
import { INCOTERM_BY_CODE } from '@/domain/incoterms';
import { can, FORBIDDEN } from '@/domain/rights';
import { awardBlockers, rankQuotes } from '@/domain/quotes';
import { NEEDS_REASON, TRANSITION_LABEL, blockers, targetOf, type Transition } from '@/domain/shipment-state';
import {
  CHECK_STATES, COMPLIANCE_CHECKS, COST_CATEGORIES, COUNTRY_RISKS, CUSTOMS_PROCEDURES, DOCUMENT_KINDS, DOCUMENT_STATES, FORMATS, FREIGHT_TYPES,
  INCIDENT_TYPES, INSURANCE_KINDS, LOAD_TYPES, MILESTONE_CODES, MODES, PACKAGE_TYPES, PARTNER_KINDS, PAYMENT_TERMS, REQUEST_ORIGINS, SEVERITIES,
  SHIPMENT_STATE_LABEL, URGENCIES, ZONES, type ShipmentState,
} from '@/domain/vocab';
import { DOCUMENT_KIND_LABEL } from '@/domain/vocab';
import {
  appSettings, bookings, complianceChecks, costLines, countries, customsDeclarations, exchangeRates, hsCodes, incidents, loads, milestones, outbox,
  packageLines, packages, partners, quotes, rfqInvitations, rfqs, shipmentAllocations, shipmentDocuments, shipmentRequests, shipments, sites,
} from '@/server/db/schema';
import { loadWorld } from '@/server/dal/world';
import { businessToday } from '@/server/clock';
import { Refusal, audit, bool, isoDay, nextRef, num, opt, reasonOf, run, shipmentFor, str, touch, tx, viewerWith, type ActionResult } from '@/server/shipping/write';

type Prev = ActionResult | null;

const country = z.string().regex(FORMATS.country, 'A country code (ISO, two letters) is expected');
const shipPath = (ref: string) => ['/', `/shipments/${ref}`];

async function siteCountry(t: Parameters<Parameters<typeof tx>[0]>[0], code: string | null): Promise<string | null> {
  if (!code) return null;
  const [s] = await t.select({ country: sites.country }).from(sites).where(eq(sites.code, code));
  if (!s) throw new Refusal('Unknown site');
  return s.country;
}

// ── Requests ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function createRequestAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('request');
    const input = z.object({
      origin: z.enum(REQUEST_ORIGINS), title: z.string().min(3, 'A title is required').max(200), description: z.string().min(3, 'A description is required').max(2000),
      projectCode: z.string().regex(FORMATS.projectCode, 'Project code: capitals, digits and dashes').nullable(),
      costCode: z.string().regex(FORMATS.costCode, 'Cost code: capitals, digits and dashes').nullable(), orderRef: z.string().max(60).nullable(),
      fromSite: z.string().nullable(), fromAddress: z.string().max(300).nullable(), fromCountry: country.nullable(),
      toSite: z.string().nullable(), toAddress: z.string().max(300).nullable(), toCountry: country.nullable(),
      readyOn: isoDay, neededOn: isoDay, urgency: z.enum(URGENCIES), dangerousGoods: z.enum(['yes', 'no', 'unknown']),
      estimatedKg: z.number().positive().nullable(), estimatedM3: z.number().positive().nullable(), estimatedValueEur: z.number().min(0).nullable(),
      incoterm: z.string().nullable(), submit: z.boolean(),
    }).parse({
      origin: str(fd, 'origin'), title: str(fd, 'title'), description: str(fd, 'description'), projectCode: opt(fd, 'projectCode')?.toUpperCase() ?? null,
      costCode: opt(fd, 'costCode')?.toUpperCase() ?? null, orderRef: opt(fd, 'orderRef'), fromSite: opt(fd, 'fromSite'), fromAddress: opt(fd, 'fromAddress'),
      fromCountry: opt(fd, 'fromCountry')?.toUpperCase() ?? null, toSite: opt(fd, 'toSite'), toAddress: opt(fd, 'toAddress'), toCountry: opt(fd, 'toCountry')?.toUpperCase() ?? null,
      readyOn: str(fd, 'readyOn'), neededOn: str(fd, 'neededOn'), urgency: str(fd, 'urgency') || 'normal', dangerousGoods: str(fd, 'dangerousGoods') || 'unknown',
      estimatedKg: num(fd, 'estimatedKg'), estimatedM3: num(fd, 'estimatedM3'), estimatedValueEur: num(fd, 'estimatedValueEur'), incoterm: opt(fd, 'incoterm'), submit: bool(fd, 'submit'),
    });
    if (!input.projectCode && !input.costCode) throw new Refusal('A project or a cost code is required');
    if (input.readyOn > input.neededOn) throw new Refusal('The date of need is before the ready date');
    if (input.incoterm && !INCOTERM_BY_CODE[input.incoterm]) throw new Refusal('Unknown Incoterm');
    await tx(async (t, today) => {
      const fromCountry = (await siteCountry(t, input.fromSite)) ?? input.fromCountry;
      const toCountry = (await siteCountry(t, input.toSite)) ?? input.toCountry;
      if (!fromCountry || !toCountry) throw new Refusal('Departure and arrival need a site or an address with its country');
      if (!input.fromSite && !input.fromAddress) throw new Refusal('Departure: a site or an address');
      if (!input.toSite && !input.toAddress) throw new Refusal('Arrival: a site or an address');
      const ref = await nextRef(t, 'SR', today);
      const [r] = await t.insert(shipmentRequests).values({
        ref, origin: input.origin, title: input.title, description: input.description, projectCode: input.projectCode, costCode: input.costCode, orderRef: input.orderRef,
        fromSite: input.fromSite, fromAddress: input.fromAddress, fromCountry, toSite: input.toSite, toAddress: input.toAddress, toCountry,
        readyOn: input.readyOn, neededOn: input.neededOn, urgency: input.urgency, dangerousGoods: input.dangerousGoods, estimatedKg: input.estimatedKg,
        estimatedM3: input.estimatedM3, estimatedValueEur: input.estimatedValueEur, incoterm: input.incoterm, state: input.submit ? 'submitted' : 'draft',
        submittedAt: input.submit ? new Date() : null, requestedById: v.userId, requestedByName: v.name,
      }).returning({ id: shipmentRequests.id });
      await audit(t, v, { objectRef: ref, change: input.submit ? 'request created and submitted' : 'request created (draft)', area: 'Requests', entityType: 'request', entityId: r.id });
    });
  }, ['/', '/requests']);
}

export async function submitRequestAction(ref: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('request');
    await tx(async (t) => {
      const [r] = await t.select().from(shipmentRequests).where(eq(shipmentRequests.ref, ref));
      if (!r || (r.requestedById !== v.userId && !can(v.roles, 'triage'))) throw new Refusal('Request not found');
      if (r.state !== 'draft') throw new Refusal('Only a draft can be submitted');
      await t.update(shipmentRequests).set({ state: 'submitted', submittedAt: new Date(), updatedAt: new Date() }).where(eq(shipmentRequests.id, r.id));
      await audit(t, v, { objectRef: ref, change: 'state: Draft → Submitted', area: 'Requests', entityType: 'request', entityId: r.id });
    });
  }, ['/', '/requests']);
}

/** Rejects or cancels a request (reason required): triage for a rejection, the requester or triage for a cancellation. */
export async function closeRequestAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('request');
    const ref = str(fd, 'ref');
    const to = str(fd, 'to') === 'rejected' ? 'rejected' : 'cancelled';
    const reason = reasonOf(fd);
    if (to === 'rejected' && !can(v.roles, 'triage')) throw new Refusal(FORBIDDEN);
    await tx(async (t) => {
      const [r] = await t.select().from(shipmentRequests).where(eq(shipmentRequests.ref, ref));
      if (!r || (r.requestedById !== v.userId && !can(v.roles, 'triage'))) throw new Refusal('Request not found');
      if (r.state !== 'draft' && r.state !== 'submitted') throw new Refusal('This request can no longer be changed');
      await t.update(shipmentRequests).set({ state: to, stateReason: reason, updatedAt: new Date() }).where(eq(shipmentRequests.id, r.id));
      await audit(t, v, { objectRef: ref, change: `state: ${r.state} → ${to}`, area: 'Requests', entityType: 'request', entityId: r.id, reason });
    });
  }, ['/', '/requests']);
}

/** Accepts a submitted request: a new shipment from it, or added to an open shipment (grouping). */
export async function acceptRequestAction(_: Prev, fd: FormData): Promise<ActionResult> {
  let target = '';
  const r = await run(async () => {
    const v = await viewerWith('triage');
    const ref = str(fd, 'ref');
    const into = opt(fd, 'shipment');
    const mode = z.enum(MODES).parse(str(fd, 'mode') || 'road');
    await tx(async (t, today) => {
      const [req] = await t.select().from(shipmentRequests).where(eq(shipmentRequests.ref, ref));
      if (!req) throw new Refusal('Request not found');
      if (req.state !== 'submitted') throw new Refusal('Only a submitted request can be accepted');
      let shipmentId: string;
      if (into) {
        const s = await shipmentFor(t, v, into);
        if (!['draft', 'planned'].includes(s.state)) throw new Refusal('Requests are grouped only into a draft or planned shipment');
        shipmentId = s.id;
        target = s.ref;
        await touch(t, s.id);
      } else {
        target = await nextRef(t, 'SH', today);
        const [s] = await t.insert(shipments).values({
          ref: target, title: req.title, mode, incoterm: req.incoterm, incotermPlace: req.incotermPlace, fromSite: req.fromSite, fromAddress: req.fromAddress,
          fromCountry: req.fromCountry, toSite: req.toSite, toAddress: req.toAddress, toCountry: req.toCountry, readyOn: req.readyOn,
          coordinatorId: v.userId, coordinatorName: v.name, insurance: 'policy',
        }).returning({ id: shipments.id });
        shipmentId = s.id;
        for (const c of COMPLIANCE_CHECKS) await t.insert(complianceChecks).values({ shipmentId, check: c });
        await audit(t, v, { objectRef: target, change: `shipment created from ${ref}`, area: 'Shipments', entityType: 'shipment', entityId: shipmentId });
      }
      await t.insert(shipmentAllocations).values({ shipmentId, requestId: req.id });
      await t.update(shipmentRequests).set({ state: 'accepted', updatedAt: new Date() }).where(eq(shipmentRequests.id, req.id));
      await audit(t, v, { objectRef: ref, change: `state: Submitted → Accepted · ${target}`, area: 'Requests', entityType: 'request', entityId: req.id });
    });
  }, ['/', '/requests', '/shipments']);
  void target;
  return r;
}

// ── Shipment details and state ───────────────────────────────────────────────────────────────────────────────────────

export async function updateShipmentAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('prepare');
    const input = z.object({
      title: z.string().min(3, 'A title is required').max(200), mode: z.enum(MODES), freightType: z.enum(FREIGHT_TYPES).nullable(),
      incoterm: z.string().nullable(), incotermPlace: z.string().max(120).nullable(),
      portOfLoading: z.string().regex(FORMATS.location, 'Port: UN/LOCODE, five characters').nullable(), portOfDischarge: z.string().regex(FORMATS.location, 'Port: UN/LOCODE, five characters').nullable(),
      payment: z.enum(PAYMENT_TERMS), lcNumber: z.string().max(60).nullable(), lcBank: z.string().max(120).nullable(), lcLatestShipment: isoDay.nullable(), lcExpiry: isoDay.nullable(),
      insurance: z.enum(INSURANCE_KINDS), readyOn: isoDay.nullable(), etd: isoDay.nullable(), eta: isoDay.nullable(), latestEta: isoDay.nullable(),
    }).parse({
      title: str(fd, 'title'), mode: str(fd, 'mode'), freightType: opt(fd, 'freightType'), incoterm: opt(fd, 'incoterm'), incotermPlace: opt(fd, 'incotermPlace'),
      portOfLoading: opt(fd, 'portOfLoading')?.toUpperCase() ?? null, portOfDischarge: opt(fd, 'portOfDischarge')?.toUpperCase() ?? null, payment: str(fd, 'payment') || 'open_account',
      lcNumber: opt(fd, 'lcNumber'), lcBank: opt(fd, 'lcBank'), lcLatestShipment: opt(fd, 'lcLatestShipment'), lcExpiry: opt(fd, 'lcExpiry'), insurance: str(fd, 'insurance') || 'policy',
      readyOn: opt(fd, 'readyOn'), etd: opt(fd, 'etd'), eta: opt(fd, 'eta'), latestEta: opt(fd, 'latestEta'),
    });
    if (input.incoterm && !INCOTERM_BY_CODE[input.incoterm]) throw new Refusal('Unknown Incoterm');
    if (input.payment === 'letter_of_credit' && !input.lcNumber) throw new Refusal('The letter of credit number is required');
    if (input.etd && input.eta && input.etd > input.eta) throw new Refusal('The ETA is before the ETD');
    const lcDocuments = fd.getAll('lcDocuments').map(String).filter((k) => (DOCUMENT_KINDS as readonly string[]).includes(k));
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      if (['closed', 'cancelled'].includes(s.state)) throw new Refusal('A closed or cancelled shipment is not changed');
      await t.update(shipments).set({ ...input, lcDocuments, updatedAt: new Date() }).where(eq(shipments.id, s.id));
      const changed = Object.entries(input).filter(([k, val]) => (s as Record<string, unknown>)[k] !== val).map(([k]) => k);
      await audit(t, v, { objectRef: ref, change: `details changed: ${changed.join(', ') || 'none'}`, area: 'Shipments', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

/** A state transition; the pure state machine decides with the facts re-read now (docs/spec/01 § 4). */
export async function transitionAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('track');
    const t = z.enum(['plan', 'book', 'pickup', 'depart', 'arrive', 'deliver', 'close', 'cancel', 'hold', 'resume', 'reopen']).parse(str(fd, 'transition')) as Transition;
    const reason = NEEDS_REASON.includes(t) || bool(fd, 'force') ? reasonOf(fd) : opt(fd, 'reason');
    const force = bool(fd, 'force');
    if (force && !can(v.roles, 'award_any')) throw new Refusal('Only the shipping manager closes without reconciled costs');
    const date = opt(fd, 'date');
    if (date) isoDay.parse(date);
    const today = await businessToday();
    if (date && date > today) throw new Refusal('An actual date cannot be in the future');
    await tx(async (db) => {
      const s = await shipmentFor(db, v, ref);
      // Dated transitions record their actual date first, then the rules decide on the new facts.
      const patch: Partial<typeof shipments.$inferInsert> = {};
      if (t === 'pickup') patch.pickedUpOn = date ?? s.pickedUpOn ?? today;
      if (t === 'depart') patch.atd = date ?? s.atd ?? today;
      if (t === 'arrive') patch.ata = date ?? s.ata ?? today;
      if (t === 'deliver') {
        patch.deliveredOn = date ?? s.deliveredOn ?? today;
        patch.podCodexRef = opt(fd, 'podCodexRef') ?? s.podCodexRef;
        patch.podSignedBy = opt(fd, 'podSignedBy') ?? s.podSignedBy;
        patch.deliveryReserves = opt(fd, 'deliveryReserves');
      }
      if (Object.keys(patch).length) await db.update(shipments).set(patch).where(eq(shipments.id, s.id));
    });
    // The actual date (a fact) is kept even if the transition is then refused. The facts come from the world loader, read after
    // the date was written; the state changes in its own transaction, which checks the state did not move meanwhile.
    const world = await loadWorld(v, today);
    const view = world.shipments.find((x) => x.s.ref === ref);
    if (!view) throw new Refusal('Shipment not found');
    const b = blockers(t, view.facts, { force });
    if (b.length) throw new Refusal(b[0]);
    await tx(async (db) => {
      const s = await shipmentFor(db, v, ref);
      if (s.state !== view.s.state) throw new Refusal('The shipment changed meanwhile, reload the page');
      const to = targetOf(t, { state: s.state as ShipmentState, previousState: (s.previousState as ShipmentState) ?? null });
      await db.update(shipments).set({
        state: to, previousState: to === 'on_hold' ? s.state : null, stateReason: to === 'on_hold' || to === 'cancelled' ? reason : null, updatedAt: new Date(),
      }).where(eq(shipments.id, s.id));
      if (t === 'depart') await db.insert(milestones).values({ shipmentId: s.id, code: 'departed', actualOn: date ?? today }).onConflictDoUpdate({ target: [milestones.shipmentId, milestones.code], set: { actualOn: date ?? today, updatedAt: new Date() } });
      if (t === 'arrive') await db.insert(milestones).values({ shipmentId: s.id, code: 'arrived', actualOn: date ?? today }).onConflictDoUpdate({ target: [milestones.shipmentId, milestones.code], set: { actualOn: date ?? today, updatedAt: new Date() } });
      if (t === 'deliver') await db.insert(milestones).values({ shipmentId: s.id, code: 'delivered', actualOn: date ?? today }).onConflictDoUpdate({ target: [milestones.shipmentId, milestones.code], set: { actualOn: date ?? today, updatedAt: new Date() } });
      if (t === 'pickup') await db.insert(milestones).values({ shipmentId: s.id, code: 'pickup', actualOn: date ?? today }).onConflictDoUpdate({ target: [milestones.shipmentId, milestones.code], set: { actualOn: date ?? today, updatedAt: new Date() } });
      await audit(db, v, {
        objectRef: ref, change: `state: ${SHIPMENT_STATE_LABEL[s.state as ShipmentState]} → ${SHIPMENT_STATE_LABEL[to]} (${TRANSITION_LABEL[t]})${force ? ' · forced' : ''}`,
        area: 'Shipments', entityType: 'shipment', entityId: s.id, reason,
      });
    });
  }, shipPath(ref));
}

// ── Packing ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const editablePacking = (state: string) => state === 'draft' || state === 'planned';

export async function addPackageAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('pack');
    const p = z.object({
      type: z.enum(PACKAGE_TYPES), lengthCm: z.number().int().min(1).max(5000), widthCm: z.number().int().min(1).max(2000), heightCm: z.number().int().min(1).max(2000),
      grossKg: z.number().positive('The gross weight is required'), netKg: z.number().positive('The net weight is required'), description: z.string().min(2, 'A description is required').max(200),
      stackable: z.boolean(), loadNumber: z.number().int().positive().nullable(), packagingCode: z.string().nullable(),
    }).parse({
      type: str(fd, 'type') || 'crate', lengthCm: num(fd, 'lengthCm'), widthCm: num(fd, 'widthCm'), heightCm: num(fd, 'heightCm'), grossKg: num(fd, 'grossKg'),
      netKg: num(fd, 'netKg'), description: str(fd, 'description'), stackable: bool(fd, 'stackable'), loadNumber: num(fd, 'loadNumber'), packagingCode: opt(fd, 'packagingCode'),
    });
    if (p.netKg > p.grossKg) throw new Refusal('The net weight is above the gross weight');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      if (!editablePacking(s.state)) throw new Refusal('The packing list is no longer changed once booked');
      const existing = await t.select({ n: packages.number }).from(packages).where(eq(packages.shipmentId, s.id));
      const number = Math.max(0, ...existing.map((x) => x.n)) + 1;
      let loadId: string | null = null;
      if (p.loadNumber) {
        const [l] = await t.select({ id: loads.id }).from(loads).where(and(eq(loads.shipmentId, s.id), eq(loads.number, p.loadNumber)));
        if (!l) throw new Refusal('Unknown load number');
        loadId = l.id;
      }
      const [row] = await t.insert(packages).values({ shipmentId: s.id, loadId, number, type: p.type, lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm, grossKg: p.grossKg, netKg: p.netKg, description: p.description, stackable: p.stackable, packagingCode: p.packagingCode }).returning({ id: packages.id });
      const line = opt(fd, 'lineDescription');
      if (line) {
        await t.insert(packageLines).values({
          packageId: row.id, description: line, quantity: num(fd, 'lineQuantity') ?? 1, hsCode: opt(fd, 'hsCode'), originCountry: opt(fd, 'originCountry')?.toUpperCase() ?? null,
          unitValue: num(fd, 'unitValue') ?? 0, currency: (opt(fd, 'currency') ?? 'EUR').toUpperCase(), netKg: p.netKg, unNumber: opt(fd, 'unNumber')?.toUpperCase() ?? null,
          dgClass: opt(fd, 'dgClass'), dgPackingGroup: opt(fd, 'dgPackingGroup'), dualUseCode: opt(fd, 'dualUseCode'),
        });
      }
      if (s.packingValidatedAt) await t.update(shipments).set({ packingValidatedAt: null }).where(eq(shipments.id, s.id));
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `package ${number} added (${p.lengthCm}×${p.widthCm}×${p.heightCm} cm, ${p.grossKg} kg)`, area: 'Shipments', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

export async function addLineAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('pack');
    const l = z.object({
      packageNumber: z.number().int().positive(), description: z.string().min(2).max(200), quantity: z.number().positive(),
      hsCode: z.string().regex(FORMATS.hsCode, 'HS code: 6 to 10 digits').nullable(), originCountry: country.nullable(), unitValue: z.number().min(0), currency: z.string().regex(FORMATS.currency),
      netKg: z.number().positive().nullable(), unNumber: z.string().regex(FORMATS.unNumber, 'UN number: UN followed by 4 digits').nullable(), dgClass: z.string().nullable(), dgPackingGroup: z.enum(['I', 'II', 'III']).nullable(),
      dualUseCode: z.string().nullable(), partRef: z.string().nullable(),
    }).parse({
      packageNumber: num(fd, 'packageNumber'), description: str(fd, 'description'), quantity: num(fd, 'quantity'), hsCode: opt(fd, 'hsCode'), originCountry: opt(fd, 'originCountry')?.toUpperCase() ?? null,
      unitValue: num(fd, 'unitValue') ?? 0, currency: (opt(fd, 'currency') ?? 'EUR').toUpperCase(), netKg: num(fd, 'netKg'), unNumber: opt(fd, 'unNumber')?.toUpperCase() ?? null,
      dgClass: opt(fd, 'dgClass'), dgPackingGroup: opt(fd, 'dgPackingGroup'), dualUseCode: opt(fd, 'dualUseCode'), partRef: opt(fd, 'partRef'),
    });
    if (l.unNumber && !l.dgClass) throw new Refusal('A dangerous good needs its class');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      if (!editablePacking(s.state)) throw new Refusal('The packing list is no longer changed once booked');
      const [p] = await t.select({ id: packages.id }).from(packages).where(and(eq(packages.shipmentId, s.id), eq(packages.number, l.packageNumber)));
      if (!p) throw new Refusal('Unknown package number');
      const { packageNumber, ...line } = l;
      await t.insert(packageLines).values({ packageId: p.id, ...line });
      if (s.packingValidatedAt) await t.update(shipments).set({ packingValidatedAt: null }).where(eq(shipments.id, s.id));
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `line added to package ${packageNumber}: ${l.quantity} × ${l.description}`, area: 'Shipments', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

export async function addLoadAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('prepare');
    const type = z.enum(LOAD_TYPES).parse(str(fd, 'type'));
    const identifier = opt(fd, 'identifier')?.toUpperCase() ?? null;
    if (identifier && ['c20', 'c40', 'c40hc', 'open_top', 'flat_rack'].includes(type) && !FORMATS.container.test(identifier)) throw new Refusal('Container number: 4 letters and 7 digits');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      const existing = await t.select({ n: loads.number }).from(loads).where(eq(loads.shipmentId, s.id));
      const number = Math.max(0, ...existing.map((x) => x.n)) + 1;
      await t.insert(loads).values({ shipmentId: s.id, number, type, identifier, seal: opt(fd, 'seal') });
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `load ${number} added (${type})`, area: 'Shipments', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

export async function validatePackingAction(ref: string): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('prepare');
    const today = await businessToday();
    const w = await loadWorld(v, today);
    const view = w.shipments.find((x) => x.s.ref === ref);
    if (!view) throw new Refusal('Shipment not found');
    if (!view.packages.length) throw new Refusal('At least one package is required');
    if (view.international && view.hs.missingHs) throw new Refusal('Every line of an international shipment needs its HS code');
    if (view.international && view.hs.missingOrigin) throw new Refusal('Every line of an international shipment needs its origin');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      await t.update(shipments).set({ packingValidatedAt: new Date(), updatedAt: new Date() }).where(eq(shipments.id, s.id));
      await audit(t, v, { objectRef: ref, change: `packing list validated: ${view.totals.packages} packages, ${view.totals.grossKg} kg, ${view.totals.volumeM3} m³`, area: 'Shipments', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

// ── RFQ, quotes, award, booking ──────────────────────────────────────────────────────────────────────────────────────

export async function createRfqAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('quote');
    const due = isoDay.parse(str(fd, 'dueOn'));
    const invited = fd.getAll('partners').map(String);
    if (!invited.length) throw new Refusal('Invite at least one partner');
    await tx(async (t, today) => {
      const s = await shipmentFor(t, v, ref);
      if (!['draft', 'planned'].includes(s.state)) throw new Refusal('A request for quotation is sent before booking');
      const ps = await t.select().from(partners).where(inArray(partners.id, invited));
      if (ps.length !== invited.length) throw new Refusal('Unknown partner');
      if (ps.some((p) => p.state !== 'active')) throw new Refusal('A suspended partner receives no request for quotation');
      const rfqRef = await nextRef(t, 'RFQ', today);
      const now = new Date();
      const [r] = await t.insert(rfqs).values({ ref: rfqRef, shipmentId: s.id, dueOn: due, scope: str(fd, 'scope') || 'door_to_door', state: 'sent', sentAt: now, note: opt(fd, 'note') }).returning({ id: rfqs.id });
      await t.insert(rfqInvitations).values(ps.map((p) => ({ rfqId: r.id, partnerId: p.id, invitedAt: now })));
      for (const p of ps) {
        await t.insert(outbox).values({ target: 'mail', kind: 'rfq', shipmentId: s.id, payload: { rfq: rfqRef, shipment: ref, to: p.contactEmail, partner: p.name, due } });
      }
      await audit(t, v, { objectRef: ref, change: `${rfqRef} sent to ${ps.map((p) => p.name).join(', ')}`, area: 'Transport', entityType: 'shipment', entityId: s.id });
    });
  }, [...shipPath(ref), '/rfq']);
}

export async function recordQuoteAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const rfqRef = str(fd, 'rfq');
  return run(async () => {
    const v = await viewerWith('quote');
    const q = z.object({
      partnerId: z.string().uuid('Choose a partner'), amount: z.number().min(0, 'An amount is required'), currency: z.string().regex(FORMATS.currency, 'Currency: three letters'),
      transitDays: z.number().int().min(0).max(365), validUntil: isoDay, departureOn: isoDay.nullable(), conditions: z.string().max(1000).nullable(), codexRef: z.string().nullable(),
    }).parse({
      partnerId: str(fd, 'partnerId'), amount: num(fd, 'amount'), currency: (str(fd, 'currency') || 'EUR').toUpperCase(), transitDays: num(fd, 'transitDays'), validUntil: str(fd, 'validUntil'),
      departureOn: opt(fd, 'departureOn'), conditions: opt(fd, 'conditions'), codexRef: opt(fd, 'codexRef'),
    });
    let shipRef = '';
    await tx(async (t) => {
      const [r] = await t.select().from(rfqs).where(eq(rfqs.ref, rfqRef));
      if (!r) throw new Refusal('Request for quotation not found');
      const [s] = await t.select().from(shipments).where(eq(shipments.id, r.shipmentId));
      await shipmentFor(t, v, s.ref);
      shipRef = s.ref;
      if (r.state !== 'sent') throw new Refusal('This request for quotation is closed');
      const now = new Date();
      await t.insert(quotes).values({ rfqId: r.id, partnerId: q.partnerId, amount: q.amount, currency: q.currency, transitDays: q.transitDays, validUntil: q.validUntil, departureOn: q.departureOn, conditions: q.conditions, codexRef: q.codexRef, receivedAt: now });
      await t.insert(rfqInvitations).values({ rfqId: r.id, partnerId: q.partnerId, invitedAt: r.sentAt ?? now, answeredAt: now }).onConflictDoUpdate({ target: [rfqInvitations.rfqId, rfqInvitations.partnerId], set: { answeredAt: now } });
      await audit(t, v, { objectRef: s.ref, change: `quote recorded on ${rfqRef}: ${q.amount} ${q.currency}, ${q.transitDays} days`, area: 'Transport', entityType: 'shipment', entityId: s.id });
    });
    void shipRef;
  }, ['/', '/rfq', '/shipments']);
}

export async function awardQuoteAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('quote');
    const quoteId = z.string().uuid().parse(str(fd, 'quote'));
    const reason = str(fd, 'reason');
    const today = await businessToday();
    await tx(async (t) => {
      const [q] = await t.select().from(quotes).where(eq(quotes.id, quoteId));
      if (!q) throw new Refusal('Quote not found');
      const [r] = await t.select().from(rfqs).where(eq(rfqs.id, q.rfqId));
      const [sRow] = await t.select().from(shipments).where(eq(shipments.id, r.shipmentId));
      const s = await shipmentFor(t, v, sRow.ref);
      const all = await t.select().from(quotes).where(eq(quotes.rfqId, r.id));
      const ps = await t.select({ id: partners.id, name: partners.name }).from(partners);
      const rates = (await t.select().from(exchangeRates)).map((x) => ({ currency: x.currency, perEur: x.perEur, on: x.on }));
      const name = (id: string) => ps.find((p) => p.id === id)?.name ?? '—';
      const ranked = rankQuotes(all.map((x) => ({ id: x.id, partnerName: name(x.partnerId), amount: x.amount, currency: x.currency, transitDays: x.transitDays, validUntil: x.validUntil, state: x.state as never })), rates, today);
      const me = ranked.find((x) => x.id === q.id);
      if (!me) throw new Refusal('Quote not found');
      const reqs = await t.select({ urgency: shipmentRequests.urgency }).from(shipmentAllocations).innerJoin(shipmentRequests, eq(shipmentRequests.id, shipmentAllocations.requestId)).where(eq(shipmentAllocations.shipmentId, s.id));
      const b = awardBlockers(me, ranked, { isManager: can(v.roles, 'award_any'), reason, critical: reqs.some((x) => x.urgency === 'critical'), estimateEur: null });
      if (b.length) throw new Refusal(b[0]);
      await t.update(quotes).set({ state: 'declined' }).where(and(eq(quotes.rfqId, r.id), eq(quotes.state, 'received')));
      await t.update(quotes).set({ state: 'awarded', awardReason: reason || null, awardedAt: new Date(), awardedByName: v.name }).where(eq(quotes.id, q.id));
      await t.update(rfqs).set({ state: 'closed', updatedAt: new Date() }).where(eq(rfqs.id, r.id));
      const rate = rateOn(rates, q.currency, today);
      await t.insert(costLines).values({ shipmentId: s.id, category: 'freight', partnerId: q.partnerId, currency: q.currency, quoted: q.amount, source: 'quote' });
      await touch(t, s.id);
      await audit(t, v, { objectRef: s.ref, change: `quote of ${name(q.partnerId)} awarded: ${q.amount} ${q.currency}${rate && q.currency !== 'EUR' ? ` (≈ ${Math.round(q.amount / rate)} EUR)` : ''}`, area: 'Transport', entityType: 'shipment', entityId: s.id, reason: reason || null });
    });
  }, ['/', '/rfq', '/shipments']);
}

export async function saveBookingAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('track');
    const b = z.object({
      partnerId: z.string().uuid('Choose the carrier'), number: z.string().min(2, 'The booking number is required').max(60), vessel: z.string().max(80).nullable(), voyage: z.string().max(30).nullable(),
      masterDocument: z.string().max(60).nullable(), houseDocument: z.string().max(60).nullable(), etd: isoDay.nullable(), eta: isoDay.nullable(),
      docsCutoff: z.string().nullable(), cargoCutoff: z.string().nullable(), vgmCutoff: z.string().nullable(),
    }).parse({
      partnerId: str(fd, 'partnerId'), number: str(fd, 'number'), vessel: opt(fd, 'vessel'), voyage: opt(fd, 'voyage'), masterDocument: opt(fd, 'masterDocument'), houseDocument: opt(fd, 'houseDocument'),
      etd: opt(fd, 'etd'), eta: opt(fd, 'eta'), docsCutoff: opt(fd, 'docsCutoff'), cargoCutoff: opt(fd, 'cargoCutoff'), vgmCutoff: opt(fd, 'vgmCutoff'),
    });
    if (b.etd && b.eta && b.etd > b.eta) throw new Refusal('The ETA is before the ETD');
    const instant = (s: string | null) => (s ? new Date(s) : null);
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      const row = { ...b, docsCutoff: instant(b.docsCutoff), cargoCutoff: instant(b.cargoCutoff), vgmCutoff: instant(b.vgmCutoff), updatedAt: new Date() };
      await t.insert(bookings).values({ shipmentId: s.id, ...row }).onConflictDoUpdate({ target: bookings.shipmentId, set: row });
      await t.update(shipments).set({ etd: b.etd ?? s.etd, eta: b.eta ?? s.eta, updatedAt: new Date() }).where(eq(shipments.id, s.id));
      await audit(t, v, { objectRef: ref, change: `booking ${b.number} recorded`, area: 'Transport', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

export async function setMilestoneAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('track');
    const m = z.object({ code: z.enum(MILESTONE_CODES), plannedOn: isoDay.nullable(), actualOn: isoDay.nullable(), place: z.string().max(120).nullable(), note: z.string().max(500).nullable(), eta: isoDay.nullable() })
      .parse({ code: str(fd, 'code'), plannedOn: opt(fd, 'plannedOn'), actualOn: opt(fd, 'actualOn'), place: opt(fd, 'place'), note: opt(fd, 'note'), eta: opt(fd, 'eta') });
    if (!m.plannedOn && !m.actualOn) throw new Refusal('A planned or an actual date is required');
    const today = await businessToday();
    if (m.actualOn && m.actualOn > today) throw new Refusal('An actual date cannot be in the future');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      const row = { plannedOn: m.plannedOn, actualOn: m.actualOn, place: m.place, note: m.note, source: 'manual' as const, updatedAt: new Date() };
      await t.insert(milestones).values({ shipmentId: s.id, code: m.code, ...row }).onConflictDoUpdate({ target: [milestones.shipmentId, milestones.code], set: row });
      await t.update(shipments).set({ latestEta: m.eta ?? s.latestEta, updatedAt: new Date() }).where(eq(shipments.id, s.id));
      await audit(t, v, { objectRef: ref, change: `milestone ${m.code}: planned ${m.plannedOn ?? '—'}, actual ${m.actualOn ?? '—'}${m.eta ? `, ETA ${m.eta}` : ''}`, area: 'Transport', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

// ── Customs, compliance, documents ───────────────────────────────────────────────────────────────────────────────────

export async function saveCustomsAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('track');
    const c = z.object({
      procedure: z.enum(CUSTOMS_PROCEDURES), mrn: z.string().regex(FORMATS.mrn, 'MRN: 18 characters (2 digits, country, 13 characters, check digit)').nullable(),
      lodgedOn: isoDay.nullable(), exitOn: isoDay.nullable(), exitCodexRef: z.string().nullable(), declarantId: z.string().uuid().nullable(), note: z.string().max(500).nullable(),
    }).parse({ procedure: str(fd, 'procedure'), mrn: opt(fd, 'mrn')?.toUpperCase() ?? null, lodgedOn: opt(fd, 'lodgedOn'), exitOn: opt(fd, 'exitOn'), exitCodexRef: opt(fd, 'exitCodexRef'), declarantId: opt(fd, 'declarantId'), note: opt(fd, 'note') });
    if (c.exitOn && !c.mrn) throw new Refusal('The exit needs the MRN');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      const row = { ...c, updatedAt: new Date() };
      await t.insert(customsDeclarations).values({ shipmentId: s.id, ...row }).onConflictDoUpdate({ target: customsDeclarations.shipmentId, set: row });
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `customs: ${c.procedure}${c.mrn ? `, MRN ${c.mrn}` : ''}${c.exitOn ? `, exit ${c.exitOn}` : ''}`, area: 'Customs', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

export async function setComplianceAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('comply');
    const check = z.enum(COMPLIANCE_CHECKS).parse(str(fd, 'check'));
    const state = z.enum(CHECK_STATES).parse(str(fd, 'state'));
    const reason = opt(fd, 'reason');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      const [c] = await t.select({ risk: countries.risk }).from(countries).where(eq(countries.code, s.toCountry));
      if (state === 'waived') {
        const b = waiverBlockers(check, (c?.risk as never) ?? 'none', reason ?? '', v.roles.includes('compliance'));
        if (b.length) throw new Refusal(b[0]);
      }
      if (check === 'destination' && state === 'ok' && c?.risk === 'embargoed') throw new Refusal('An embargoed destination cannot be cleared');
      const row = { state, detail: opt(fd, 'detail'), evidenceCodexRef: opt(fd, 'evidence'), reason, byName: state === 'pending' ? null : v.name, at: state === 'pending' ? null : new Date() };
      await t.insert(complianceChecks).values({ shipmentId: s.id, check, ...row }).onConflictDoUpdate({ target: [complianceChecks.shipmentId, complianceChecks.check], set: row });
      const all = await t.select({ state: complianceChecks.state }).from(complianceChecks).where(eq(complianceChecks.shipmentId, s.id));
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `compliance ${check}: ${state}${complianceCleared(all.map((x) => x.state as never)) ? ' · checklist cleared' : ''}`, area: 'Customs', entityType: 'shipment', entityId: s.id, reason });
    });
  }, shipPath(ref));
}

export async function setDocumentAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('track');
    const d = z.object({ kind: z.enum(DOCUMENT_KINDS), state: z.enum(DOCUMENT_STATES), number: z.string().max(60).nullable(), codexRef: z.string().regex(/^[A-Z]{2,5}-[A-Z0-9-]{1,40}$/, 'Codex reference: TYPE-CONTEXT-NUMBER').nullable(), reason: z.string().max(500).nullable(), issuedOn: isoDay.nullable() })
      .parse({ kind: str(fd, 'kind'), state: str(fd, 'state'), number: opt(fd, 'number'), codexRef: opt(fd, 'codexRef')?.toUpperCase() ?? null, reason: opt(fd, 'reason'), issuedOn: opt(fd, 'issuedOn') });
    if ((d.state === 'received' || d.state === 'checked') && !d.codexRef) throw new Refusal('A received document needs its Codex reference (Vector stores no file)');
    if ((d.state === 'waived' || d.state === 'rejected') && !d.reason) throw new Refusal('A reason is required');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      const row = { state: d.state, number: d.number, codexRef: d.codexRef, reason: d.reason, issuedOn: d.issuedOn, updatedAt: new Date(), updatedByName: v.name };
      await t.insert(shipmentDocuments).values({ shipmentId: s.id, kind: d.kind, ...row }).onConflictDoUpdate({ target: [shipmentDocuments.shipmentId, shipmentDocuments.kind], set: row });
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `document ${DOCUMENT_KIND_LABEL[d.kind]}: ${d.state}${d.codexRef ? ` (${d.codexRef})` : ''}`, area: 'Documents', entityType: 'shipment', entityId: s.id, reason: d.reason });
    });
  }, shipPath(ref));
}

/** Generates a document of Vector (packing list, marks, proforma, instructions, CMR, VGM) and queues its deposit in Codex. */
export async function generateDocumentAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('track');
    const kind = z.enum(['packing_list', 'proforma_invoice', 'marks', 'shipping_instructions', 'cmr', 'vgm']).parse(str(fd, 'kind'));
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      await t.insert(outbox).values({ target: 'codex', kind: 'deposit_document', shipmentId: s.id, payload: { shipment: ref, kind, title: `${DOCUMENT_KIND_LABEL[kind]} ${ref}`, url: `/print/shipments/${ref}/${kind}` } });
      await t.insert(shipmentDocuments).values({ shipmentId: s.id, kind, state: 'expected', generated: true, updatedByName: v.name })
        .onConflictDoUpdate({ target: [shipmentDocuments.shipmentId, shipmentDocuments.kind], set: { generated: true, updatedAt: new Date(), updatedByName: v.name } });
      await audit(t, v, { objectRef: ref, change: `document ${DOCUMENT_KIND_LABEL[kind]} generated, deposit in Codex queued`, area: 'Documents', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

// ── Incidents ────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function reportIncidentAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('incident');
    const i = z.object({ type: z.enum(INCIDENT_TYPES), severity: z.enum(SEVERITIES), occurredOn: isoDay, place: z.string().max(120).nullable(), description: z.string().min(5, 'Describe what happened').max(2000), reservesWritten: z.boolean(), partnerId: z.string().uuid().nullable(), photosCodexRef: z.string().nullable() })
      .parse({ type: str(fd, 'type'), severity: str(fd, 'severity') || 'minor', occurredOn: str(fd, 'occurredOn'), place: opt(fd, 'place'), description: str(fd, 'description'), reservesWritten: bool(fd, 'reservesWritten'), partnerId: opt(fd, 'partnerId'), photosCodexRef: opt(fd, 'photosCodexRef') });
    const today = await businessToday();
    if (i.occurredOn > today) throw new Refusal('An incident cannot be in the future');
    await tx(async (t, day) => {
      const s = await shipmentFor(t, v, ref);
      const incRef = await nextRef(t, 'INC', day);
      const [row] = await t.insert(incidents).values({ ref: incRef, shipmentId: s.id, ...i, reportedByName: v.name }).returning({ id: incidents.id });
      if (i.type === 'safety') await t.insert(outbox).values({ target: 'vigie', kind: 'transport_incident', shipmentId: s.id, payload: { incident: incRef, shipment: ref, severity: i.severity, on: i.occurredOn } });
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `${incRef} reported: ${i.type}, ${i.severity}`, area: 'Incidents', entityType: 'incident', entityId: row.id });
    });
  }, [...shipPath(ref), '/incidents']);
}

export async function updateIncidentAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('track');
    const ref = str(fd, 'incident');
    const to = z.enum(['claimed', 'settled', 'rejected', 'closed']).parse(str(fd, 'to'));
    await tx(async (t) => {
      const [i] = await t.select().from(incidents).where(eq(incidents.ref, ref));
      if (!i) throw new Refusal('Incident not found');
      const [s] = await t.select().from(shipments).where(eq(shipments.id, i.shipmentId));
      await shipmentFor(t, v, s.ref);
      const patch: Partial<typeof incidents.$inferInsert> = { state: to, updatedAt: new Date() };
      if (to === 'claimed') {
        patch.claimedAmount = z.number().min(0, 'The amount claimed is required').parse(num(fd, 'claimedAmount'));
        patch.claimCurrency = (str(fd, 'claimCurrency') || 'EUR').toUpperCase();
        patch.claimSentOn = isoDay.parse(str(fd, 'claimSentOn'));
        patch.partnerId = opt(fd, 'partnerId') ?? i.partnerId;
      } else if (to === 'settled') {
        if (i.state !== 'claimed') throw new Refusal('Only a claim is settled');
        patch.recoveredAmount = z.number().min(0).parse(num(fd, 'recoveredAmount'));
      } else if (to === 'rejected') {
        if (i.state !== 'claimed') throw new Refusal('Only a claim is rejected');
      } else {
        patch.stateReason = reasonOf(fd);
      }
      await t.update(incidents).set(patch).where(eq(incidents.id, i.id));
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `state: ${i.state} → ${to}`, area: 'Incidents', entityType: 'incident', entityId: i.id, reason: patch.stateReason ?? null });
    });
  }, ['/', '/incidents', '/shipments']);
}

// ── Costs ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function addCostAction(_: Prev, fd: FormData): Promise<ActionResult> {
  const ref = str(fd, 'ref');
  return run(async () => {
    const v = await viewerWith('see_costs');
    if (!can(v.roles, 'prepare') && !can(v.roles, 'reconcile')) throw new Refusal(FORBIDDEN);
    const c = z.object({ category: z.enum(COST_CATEGORIES), partnerId: z.string().uuid().nullable(), currency: z.string().regex(FORMATS.currency), estimated: z.number().min(0).nullable(), quoted: z.number().min(0).nullable(), invoiced: z.number().min(0).nullable(), invoiceNumber: z.string().max(60).nullable(), invoiceDate: isoDay.nullable() })
      .parse({ category: str(fd, 'category'), partnerId: opt(fd, 'partnerId'), currency: (str(fd, 'currency') || 'EUR').toUpperCase(), estimated: num(fd, 'estimated'), quoted: num(fd, 'quoted'), invoiced: num(fd, 'invoiced'), invoiceNumber: opt(fd, 'invoiceNumber'), invoiceDate: opt(fd, 'invoiceDate') });
    if (c.estimated == null && c.quoted == null && c.invoiced == null) throw new Refusal('An amount is required');
    if (c.invoiced != null && (!c.invoiceNumber || !c.invoiceDate)) throw new Refusal('An invoice needs its number and date');
    await tx(async (t) => {
      const s = await shipmentFor(t, v, ref);
      await t.insert(costLines).values({ shipmentId: s.id, ...c, source: c.invoiced != null ? 'manual' : c.quoted != null ? 'quote' : 'estimate' });
      await touch(t, s.id);
      await audit(t, v, { objectRef: ref, change: `cost line ${c.category} added`, area: 'Costs', entityType: 'shipment', entityId: s.id });
    });
  }, shipPath(ref));
}

export async function invoiceCostAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('reconcile');
    const id = z.string().uuid().parse(str(fd, 'line'));
    const invoiced = z.number().min(0, 'The invoiced amount is required').parse(num(fd, 'invoiced'));
    const invoiceNumber = z.string().min(1, 'The invoice number is required').parse(str(fd, 'invoiceNumber'));
    const invoiceDate = isoDay.parse(str(fd, 'invoiceDate'));
    const reconcile = bool(fd, 'reconcile');
    const reason = opt(fd, 'reason');
    await tx(async (t) => {
      const [c] = await t.select().from(costLines).where(eq(costLines.id, id));
      if (!c) throw new Refusal('Cost line not found');
      const [s] = await t.select().from(shipments).where(eq(shipments.id, c.shipmentId));
      await shipmentFor(t, v, s.ref);
      const [threshold] = await t.select().from(appSettings).where(eq(appSettings.key, 'vector.variance_threshold'));
      const limit = typeof threshold?.value === 'number' ? threshold.value : 0.05;
      if (reconcile && c.quoted && Math.abs(invoiced - c.quoted) / c.quoted > limit && !reason) throw new Refusal('The variance is above the threshold: a reason is required to reconcile');
      await t.update(costLines).set({ invoiced, invoiceNumber, invoiceDate, reconciled: reconcile, varianceReason: reason, updatedAt: new Date() }).where(eq(costLines.id, id));
      await touch(t, s.id);
      await audit(t, v, { objectRef: s.ref, change: `invoice ${invoiceNumber}: ${invoiced} ${c.currency}${reconcile ? ' · reconciled' : ''}`, area: 'Costs', entityType: 'shipment', entityId: s.id, reason });
    });
  }, ['/', '/shipments', '/reports']);
}

// ── Partners and reference lists ─────────────────────────────────────────────────────────────────────────────────────

export async function savePartnerAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('partners');
    const p = z.object({
      name: z.string().min(2, 'A name is required').max(120), kind: z.enum(PARTNER_KINDS), country, modes: z.array(z.enum(MODES)).min(1, 'At least one mode'), zones: z.array(z.enum(ZONES)),
      accreditations: z.string().max(200).nullable(), contactRole: z.string().max(80).nullable(), contactEmail: z.string().email('A professional e-mail address is expected').nullable(), contactPhone: z.string().max(40).nullable(),
    }).parse({
      name: str(fd, 'name'), kind: str(fd, 'kind'), country: str(fd, 'country').toUpperCase(), modes: fd.getAll('modes').map(String), zones: fd.getAll('zones').map(String),
      accreditations: opt(fd, 'accreditations'), contactRole: opt(fd, 'contactRole'), contactEmail: opt(fd, 'contactEmail'), contactPhone: opt(fd, 'contactPhone'),
    });
    const id = opt(fd, 'id');
    await tx(async (t) => {
      if (id) {
        await t.update(partners).set({ ...p, updatedAt: new Date() }).where(eq(partners.id, id));
        await audit(t, v, { objectRef: `Partner ${p.name}`, change: 'partner changed', area: 'Partners', entityType: 'partner', entityId: id });
      } else {
        const [row] = await t.insert(partners).values(p).returning({ id: partners.id });
        await audit(t, v, { objectRef: `Partner ${p.name}`, change: 'partner created', area: 'Partners', entityType: 'partner', entityId: row.id });
      }
    });
  }, ['/partners']);
}

export async function setPartnerStateAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('partners');
    const id = z.string().uuid().parse(str(fd, 'id'));
    const state = z.enum(['active', 'suspended', 'archived']).parse(str(fd, 'state'));
    const reason = state === 'active' ? opt(fd, 'reason') : reasonOf(fd);
    await tx(async (t) => {
      const [p] = await t.select().from(partners).where(eq(partners.id, id));
      if (!p) throw new Refusal('Partner not found');
      await t.update(partners).set({ state, stateReason: state === 'active' ? null : reason, updatedAt: new Date() }).where(eq(partners.id, id));
      await audit(t, v, { objectRef: `Partner ${p.name}`, change: `state: ${p.state} → ${state}`, area: 'Partners', entityType: 'partner', entityId: id, reason });
    });
  }, ['/partners']);
}

export async function addRateAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('reconcile');
    const r = z.object({ currency: z.string().regex(FORMATS.currency).refine((c) => c !== 'EUR', 'The euro is the reference'), on: isoDay, perEur: z.number().positive('A positive rate is expected') })
      .parse({ currency: str(fd, 'currency').toUpperCase(), on: str(fd, 'on'), perEur: num(fd, 'perEur') });
    await tx(async (t) => {
      await t.insert(exchangeRates).values(r).onConflictDoUpdate({ target: [exchangeRates.currency, exchangeRates.on], set: { perEur: r.perEur } });
      await audit(t, v, { objectRef: `Rate ${r.currency}`, change: `1 EUR = ${r.perEur} ${r.currency} on ${r.on}`, area: 'Administration' });
    });
  }, ['/admin', '/reports']);
}

export async function setCountryRiskAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('comply');
    const code = country.parse(str(fd, 'code').toUpperCase());
    const risk = z.enum(COUNTRY_RISKS).parse(str(fd, 'risk'));
    const reason = reasonOf(fd);
    await tx(async (t) => {
      const [c] = await t.select().from(countries).where(eq(countries.code, code));
      if (!c) throw new Refusal('Unknown country');
      await t.update(countries).set({ risk, note: reason }).where(eq(countries.code, code));
      await audit(t, v, { objectRef: `Country ${code}`, change: `risk: ${c.risk} → ${risk}`, area: 'Customs', reason });
    });
  }, ['/customs', '/admin']);
}

export async function addHsCodeAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('comply');
    const h = z.object({ code: z.string().regex(FORMATS.hsCode, 'HS code: 6 to 10 digits'), description: z.string().min(3).max(300), dualUseCode: z.string().regex(/^[0-9][A-E][0-9]{3}[a-z0-9.]*$/, 'Control number: e.g. 3A999').nullable(), validated: z.boolean() })
      .parse({ code: str(fd, 'code'), description: str(fd, 'description'), dualUseCode: opt(fd, 'dualUseCode'), validated: bool(fd, 'validated') });
    await tx(async (t) => {
      await t.insert(hsCodes).values(h).onConflictDoUpdate({ target: hsCodes.code, set: { description: h.description, dualUseCode: h.dualUseCode, validated: h.validated } });
      await audit(t, v, { objectRef: `HS ${h.code}`, change: `HS code saved${h.validated ? ' (validated)' : ''}`, area: 'Customs' });
    });
  }, ['/customs']);
}

export async function saveThresholdsAction(_: Prev, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const v = await viewerWith('reference');
    const s = z.object({
      award_approval_eur: z.number().min(0), competition_eur: z.number().min(0), min_quotes: z.number().int().min(1).max(10), variance_threshold: z.number().min(0).max(1),
      tolerance_days: z.number().int().min(0).max(30), heavy_lift_kg: z.number().min(100),
    }).parse({
      award_approval_eur: num(fd, 'award_approval_eur'), competition_eur: num(fd, 'competition_eur'), min_quotes: num(fd, 'min_quotes'), variance_threshold: (num(fd, 'variance_pct') ?? 5) / 100,
      tolerance_days: num(fd, 'tolerance_days'), heavy_lift_kg: num(fd, 'heavy_lift_kg'),
    });
    await tx(async (t) => {
      for (const [k, val] of Object.entries(s)) {
        await t.insert(appSettings).values({ key: `vector.${k}`, value: val, updatedByName: v.name }).onConflictDoUpdate({ target: appSettings.key, set: { value: val, updatedAt: new Date(), updatedByName: v.name } });
      }
      await audit(t, v, { objectRef: 'Thresholds', change: Object.entries(s).map(([k, x]) => `${k} = ${x}`).join(', '), area: 'Administration' });
    });
  }, ['/admin']);
}
