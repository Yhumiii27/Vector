'use client';
// The side-panel forms of Vector (Norma § 7: never a form open in the page — a button opens a panel, closed on success). Each
// one only collects the input; its Server Function (./actions.ts) checks everything again. Labels are EN source strings.
import type { ReactNode } from 'react';
import { ActionButton, ActionForm, Folded } from '@/components/app/ActionForm';
import { Field, Input, Select, Textarea } from '@norma/charte/ds/Field';
import { useI18n } from '@/i18n/client';
import {
  CHECK_STATES, CHECK_STATE_LABEL, COMPLIANCE_CHECK_LABEL, COST_CATEGORIES, COST_CATEGORY_LABEL, COUNTRY_RISKS, COUNTRY_RISK_LABEL, CUSTOMS_PROCEDURES,
  CUSTOMS_PROCEDURE_LABEL, DOCUMENT_KINDS, DOCUMENT_KIND_LABEL, DOCUMENT_STATES, DOCUMENT_STATE_LABEL, FREIGHT_TYPES, FREIGHT_TYPE_LABEL, INCIDENT_TYPES,
  INCIDENT_TYPE_LABEL, INSURANCE_KINDS, INSURANCE_LABEL, LOAD_TYPES, LOAD_TYPE_LABEL, MILESTONE_CODES, MILESTONE_LABEL, MODES, MODE_LABEL, PACKAGE_TYPES,
  PACKAGE_TYPE_LABEL, PARTNER_KINDS, PARTNER_KIND_LABEL, PAYMENT_TERMS, PAYMENT_TERM_LABEL, REQUEST_ORIGINS, REQUEST_ORIGIN_LABEL, SEVERITIES, SEVERITY_LABEL,
  URGENCIES, URGENCY_LABEL, ZONES, ZONE_LABEL, type ComplianceCheck,
} from '@/domain/vocab';
import { TRANSITION_LABEL, NEEDS_REASON, type Transition } from '@/domain/shipment-state';
import * as A from './actions';
import s from './forms.module.css';

export interface Option { value: string; label: string }

function useOpts() {
  const { t } = useI18n();
  return <K extends string>(keys: readonly K[], labels: Record<K, string>, empty?: string): Option[] => [
    ...(empty ? [{ value: '', label: t(empty) }] : []),
    ...keys.map((k) => ({ value: k, label: t(labels[k]) })),
  ];
}

const Row = ({ children }: { children: ReactNode }) => <div className={s.row}>{children}</div>;

function L({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const { t } = useI18n();
  return <Field label={t(label)} hint={hint ? t(hint) : undefined}>{children}</Field>;
}

const Hidden = ({ name, value }: { name: string; value: string }) => <input type="hidden" name={name} value={value} />;

function Checks({ name, options, defaults = [] }: { name: string; options: Option[]; defaults?: string[] }) {
  return (
    <div className={s.checks}>
      {options.map((o) => (
        <label key={o.value} className={s.check}>
          <input type="checkbox" name={name} value={o.value} defaultChecked={defaults.includes(o.value)} /> {o.label}
        </label>
      ))}
    </div>
  );
}

// ── Requests ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function NewRequestForm({ sites, incoterms, today, primary }: { sites: Option[]; incoterms: Option[]; today: string; primary?: boolean }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="New shipment request" variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.createRequestAction} submit="Save the request" done="Request saved">
        <L label="Title"><Input name="title" required maxLength={200} /></L>
        <Row>
          <L label="Origin"><Select name="origin" options={o(REQUEST_ORIGINS, REQUEST_ORIGIN_LABEL)} /></L>
          <L label="Urgency"><Select name="urgency" options={o(URGENCIES, URGENCY_LABEL)} /></L>
        </Row>
        <Row>
          <L label="Keystone project"><Input name="projectCode" placeholder="DEMO-101" /></L>
          <L label="Cost code"><Input name="costCode" placeholder="SAV-PIECES" /></L>
        </Row>
        <L label="Order number"><Input name="orderRef" /></L>
        <Row>
          <L label="Departure site"><Select name="fromSite" options={[{ value: '', label: t('Address below') }, ...sites]} /></L>
          <L label="Arrival site"><Select name="toSite" options={[{ value: '', label: t('Address below') }, ...sites]} /></L>
        </Row>
        <Row>
          <L label="Departure address"><Input name="fromAddress" /></L>
          <L label="Country (ISO)"><Input name="fromCountry" maxLength={2} /></L>
        </Row>
        <Row>
          <L label="Arrival address"><Input name="toAddress" /></L>
          <L label="Country (ISO)"><Input name="toCountry" maxLength={2} /></L>
        </Row>
        <Row>
          <L label="Ready on"><Input name="readyOn" type="date" defaultValue={today} required /></L>
          <L label="Needed on"><Input name="neededOn" type="date" required /></L>
        </Row>
        <L label="What is shipped"><Textarea name="description" rows={3} required /></L>
        <Row>
          <L label="Estimated weight (kg)"><Input name="estimatedKg" inputMode="decimal" /></L>
          <L label="Estimated volume (m³)"><Input name="estimatedM3" inputMode="decimal" /></L>
        </Row>
        <Row>
          <L label="Estimated value (EUR)"><Input name="estimatedValueEur" inputMode="decimal" /></L>
          <L label="Dangerous goods"><Select name="dangerousGoods" options={[{ value: 'unknown', label: t('Do not know') }, { value: 'no', label: t('No') }, { value: 'yes', label: t('Yes') }]} /></L>
        </Row>
        <L label="Incoterm"><Select name="incoterm" options={[{ value: '', label: t('Contract Incoterm (Keystone)') }, ...incoterms]} /></L>
        <label className={s.check}><input type="checkbox" name="submit" defaultChecked /> {t('Submit to the shipping team now')}</label>
      </ActionForm>
    </Folded>
  );
}

export function AcceptRequestForm({ reqRef, groupable }: { reqRef: string; groupable: Option[] }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Accept" title="Accept the request">
      <ActionForm action={A.acceptRequestAction} submit="Accept" done="Request accepted">
        <Hidden name="ref" value={reqRef} />
        <L label="Shipment" hint="A new shipment, or grouped into a draft or planned one"><Select name="shipment" options={[{ value: '', label: t('New shipment') }, ...groupable]} /></L>
        <L label="Mode of a new shipment"><Select name="mode" options={o(MODES, MODE_LABEL)} /></L>
      </ActionForm>
    </Folded>
  );
}

export function CloseRequestForm({ reqRef, to }: { reqRef: string; to: 'rejected' | 'cancelled' }) {
  return (
    <Folded summary={to === 'rejected' ? 'Reject' : 'Cancel the request'}>
      <ActionForm action={A.closeRequestAction} submit={to === 'rejected' ? 'Reject' : 'Cancel the request'} done="Request closed" variant="secondary">
        <Hidden name="ref" value={reqRef} />
        <Hidden name="to" value={to} />
        <L label="Reason"><Textarea name="reason" rows={3} required /></L>
      </ActionForm>
    </Folded>
  );
}

export function SubmitRequestButton({ reqRef }: { reqRef: string }) {
  return <ActionButton run={A.submitRequestAction.bind(null, reqRef)} label="Submit" done="Request submitted" />;
}

// ── Shipment ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ShipmentDefaults {
  ref: string; title: string; mode: string; freightType: string | null; incoterm: string | null; incotermPlace: string | null; portOfLoading: string | null;
  portOfDischarge: string | null; payment: string; lcNumber: string | null; lcBank: string | null; lcLatestShipment: string | null; lcExpiry: string | null;
  lcDocuments: string[]; insurance: string; readyOn: string | null; etd: string | null; eta: string | null; latestEta: string | null;
}

export function ShipmentDetailsForm({ d, incoterms }: { d: ShipmentDefaults; incoterms: Option[] }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Edit the shipment">
      <ActionForm action={A.updateShipmentAction} submit="Save" done="Shipment saved">
        <Hidden name="ref" value={d.ref} />
        <L label="Title"><Input name="title" defaultValue={d.title} required /></L>
        <Row>
          <L label="Mode"><Select name="mode" defaultValue={d.mode} options={o(MODES, MODE_LABEL)} /></L>
          <L label="Freight type"><Select name="freightType" defaultValue={d.freightType ?? ''} options={o(FREIGHT_TYPES, FREIGHT_TYPE_LABEL, '—')} /></L>
        </Row>
        <Row>
          <L label="Incoterm"><Select name="incoterm" defaultValue={d.incoterm ?? ''} options={[{ value: '', label: '—' }, ...incoterms]} /></L>
          <L label="Named place"><Input name="incotermPlace" defaultValue={d.incotermPlace ?? ''} /></L>
        </Row>
        <Row>
          <L label="Port of loading (UN/LOCODE)"><Input name="portOfLoading" defaultValue={d.portOfLoading ?? ''} maxLength={5} /></L>
          <L label="Port of discharge (UN/LOCODE)"><Input name="portOfDischarge" defaultValue={d.portOfDischarge ?? ''} maxLength={5} /></L>
        </Row>
        <Row>
          <L label="Ready on"><Input name="readyOn" type="date" defaultValue={d.readyOn ?? ''} /></L>
          <L label="Insurance"><Select name="insurance" defaultValue={d.insurance} options={o(INSURANCE_KINDS, INSURANCE_LABEL)} /></L>
        </Row>
        <Row>
          <L label="ETD"><Input name="etd" type="date" defaultValue={d.etd ?? ''} /></L>
          <L label="ETA"><Input name="eta" type="date" defaultValue={d.eta ?? ''} /></L>
        </Row>
        <L label="Latest ETA announced"><Input name="latestEta" type="date" defaultValue={d.latestEta ?? ''} /></L>
        <L label="Payment"><Select name="payment" defaultValue={d.payment} options={o(PAYMENT_TERMS, PAYMENT_TERM_LABEL)} /></L>
        <Row>
          <L label="Letter of credit number"><Input name="lcNumber" defaultValue={d.lcNumber ?? ''} /></L>
          <L label="Issuing bank"><Input name="lcBank" defaultValue={d.lcBank ?? ''} /></L>
        </Row>
        <Row>
          <L label="Latest shipment date"><Input name="lcLatestShipment" type="date" defaultValue={d.lcLatestShipment ?? ''} /></L>
          <L label="Expiry"><Input name="lcExpiry" type="date" defaultValue={d.lcExpiry ?? ''} /></L>
        </Row>
        <L label="Documents the letter of credit asks for"><Checks name="lcDocuments" options={o(DOCUMENT_KINDS, DOCUMENT_KIND_LABEL)} defaults={d.lcDocuments} /></L>
        <p className={s.hint}>{t('Changing the packing list after its validation asks for a new validation.')}</p>
      </ActionForm>
    </Folded>
  );
}

export function TransitionForm({ shipRef, transition, primary, needsDate, deliver }: { shipRef: string; transition: Transition; primary?: boolean; needsDate?: boolean; deliver?: boolean }) {
  const { t } = useI18n();
  const reason = NEEDS_REASON.includes(transition);
  return (
    <Folded summary={TRANSITION_LABEL[transition]} variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.transitionAction} submit={TRANSITION_LABEL[transition]} done="Shipment updated">
        <Hidden name="ref" value={shipRef} />
        <Hidden name="transition" value={transition} />
        {needsDate && <L label="Actual date"><Input name="date" type="date" /></L>}
        {deliver && (
          <>
            <L label="Proof of delivery (Codex reference)"><Input name="podCodexRef" required placeholder="POD-…" /></L>
            <L label="Signed by"><Input name="podSignedBy" /></L>
            <L label="Reserves written on delivery"><Textarea name="deliveryReserves" rows={2} /></L>
          </>
        )}
        {(reason || transition === 'close') && (
          <L label={reason ? 'Reason' : 'Reason (to close without reconciled costs)'}><Textarea name="reason" rows={2} required={reason} /></L>
        )}
        {transition === 'close' && <label className={s.check}><input type="checkbox" name="force" /> {t('Close even if the costs are not reconciled (shipping manager)')}</label>}
      </ActionForm>
    </Folded>
  );
}

export function ValidatePackingButton({ shipRef }: { shipRef: string }) {
  return <ActionButton run={A.validatePackingAction.bind(null, shipRef)} label="Validate the packing list" done="Packing list validated" />;
}

export function PackageForm({ shipRef, loads, packaging }: { shipRef: string; loads: Option[]; packaging: Option[] }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Add a package">
      <ActionForm action={A.addPackageAction} submit="Add the package" done="Package added">
        <Hidden name="ref" value={shipRef} />
        <Row>
          <L label="Type"><Select name="type" options={o(PACKAGE_TYPES, PACKAGE_TYPE_LABEL)} /></L>
          <L label="Packaging standard"><Select name="packagingCode" options={[{ value: '', label: '—' }, ...packaging]} /></L>
        </Row>
        <L label="Description"><Input name="description" required /></L>
        <Row>
          <L label="Length (cm)"><Input name="lengthCm" inputMode="numeric" required /></L>
          <L label="Width (cm)"><Input name="widthCm" inputMode="numeric" required /></L>
          <L label="Height (cm)"><Input name="heightCm" inputMode="numeric" required /></L>
        </Row>
        <Row>
          <L label="Gross weight (kg)"><Input name="grossKg" inputMode="decimal" required /></L>
          <L label="Net weight (kg)"><Input name="netKg" inputMode="decimal" required /></L>
        </Row>
        <Row>
          <L label="Load"><Select name="loadNumber" options={[{ value: '', label: '—' }, ...loads]} /></L>
          <label className={s.check}><input type="checkbox" name="stackable" defaultChecked /> {t('Stackable')}</label>
        </Row>
        <p className={s.hint}>{t('First content line (optional)')}</p>
        <L label="Content"><Input name="lineDescription" /></L>
        <Row>
          <L label="Quantity"><Input name="lineQuantity" inputMode="decimal" /></L>
          <L label="HS code"><Input name="hsCode" inputMode="numeric" /></L>
          <L label="Origin (ISO)"><Input name="originCountry" maxLength={2} /></L>
        </Row>
        <Row>
          <L label="Unit value"><Input name="unitValue" inputMode="decimal" /></L>
          <L label="Currency"><Input name="currency" defaultValue="EUR" maxLength={3} /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

export function LineForm({ shipRef, packages }: { shipRef: string; packages: Option[] }) {
  return (
    <Folded summary="Add a content line">
      <ActionForm action={A.addLineAction} submit="Add the line" done="Line added">
        <Hidden name="ref" value={shipRef} />
        <L label="Package"><Select name="packageNumber" options={packages} /></L>
        <L label="Description"><Input name="description" required /></L>
        <Row>
          <L label="Article (Keystone)"><Input name="partRef" /></L>
          <L label="Quantity"><Input name="quantity" inputMode="decimal" defaultValue="1" required /></L>
        </Row>
        <Row>
          <L label="HS code"><Input name="hsCode" inputMode="numeric" /></L>
          <L label="Origin (ISO)"><Input name="originCountry" maxLength={2} /></L>
          <L label="Net weight (kg)"><Input name="netKg" inputMode="decimal" /></L>
        </Row>
        <Row>
          <L label="Unit value"><Input name="unitValue" inputMode="decimal" /></L>
          <L label="Currency"><Input name="currency" defaultValue="EUR" maxLength={3} /></L>
        </Row>
        <L label="Dual-use control number"><Input name="dualUseCode" placeholder="3A999" /></L>
        <Row>
          <L label="UN number"><Input name="unNumber" placeholder="UN1993" /></L>
          <L label="Class"><Input name="dgClass" placeholder="3" /></L>
          <L label="Packing group"><Select name="dgPackingGroup" options={[{ value: '', label: '—' }, { value: 'I', label: 'I' }, { value: 'II', label: 'II' }, { value: 'III', label: 'III' }]} /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

export function LoadForm({ shipRef }: { shipRef: string }) {
  const o = useOpts();
  return (
    <Folded summary="Add a load">
      <ActionForm action={A.addLoadAction} submit="Add the load" done="Load added">
        <Hidden name="ref" value={shipRef} />
        <L label="Type"><Select name="type" options={o(LOAD_TYPES, LOAD_TYPE_LABEL)} /></L>
        <Row>
          <L label="Container or registration number"><Input name="identifier" /></L>
          <L label="Seal"><Input name="seal" /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

// ── Transport ────────────────────────────────────────────────────────────────────────────────────────────────────────

export function RfqForm({ shipRef, partners, due }: { shipRef: string; partners: Option[]; due: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Request quotations">
      <ActionForm action={A.createRfqAction} submit="Send the request for quotation" done="Request for quotation sent">
        <Hidden name="ref" value={shipRef} />
        <L label="Scope"><Select name="scope" options={[
          { value: 'door_to_door', label: t('Door to door') }, { value: 'pre_carriage', label: t('Pre-carriage') }, { value: 'main_carriage', label: t('Main carriage') }, { value: 'on_carriage', label: t('On-carriage') },
        ]} /></L>
        <L label="Answer expected by"><Input name="dueOn" type="date" defaultValue={due} required /></L>
        <L label="Partners invited"><Checks name="partners" options={partners} /></L>
        <L label="Note to the partners"><Textarea name="note" rows={3} /></L>
        <p className={s.hint}>{t('The message is queued for the mail (simulated until the IT department chooses the transport); the packing list goes with it, without the values.')}</p>
      </ActionForm>
    </Folded>
  );
}

export function QuoteForm({ rfqRef, partners, label = 'Record a quote' }: { rfqRef: string; partners: Option[]; label?: string }) {
  return (
    <Folded summary={label}>
      <ActionForm action={A.recordQuoteAction} submit="Record the quote" done="Quote recorded">
        <Hidden name="rfq" value={rfqRef} />
        <L label="Partner"><Select name="partnerId" options={partners} /></L>
        <Row>
          <L label="Total amount"><Input name="amount" inputMode="decimal" required /></L>
          <L label="Currency"><Input name="currency" defaultValue="EUR" maxLength={3} /></L>
        </Row>
        <Row>
          <L label="Transit time (days)"><Input name="transitDays" inputMode="numeric" required /></L>
          <L label="Valid until"><Input name="validUntil" type="date" required /></L>
        </Row>
        <L label="Proposed departure"><Input name="departureOn" type="date" /></L>
        <L label="Conditions and exclusions"><Textarea name="conditions" rows={2} /></L>
        <L label="Quote in Codex"><Input name="codexRef" /></L>
      </ActionForm>
    </Folded>
  );
}

export function AwardForm({ quoteId, label }: { quoteId: string; label: string }) {
  const { t } = useI18n();
  return (
    <Folded summary="Award" title={label}>
      <ActionForm action={A.awardQuoteAction} submit="Award" done="Quote awarded">
        <Hidden name="quote" value={quoteId} />
        <L label="Reason (required if not the cheapest, or fewer quotes than required)"><Textarea name="reason" rows={2} /></L>
        <p className={s.hint}>{t('The other quotes are declined; the freight cost line is created from the quote.')}</p>
      </ActionForm>
    </Folded>
  );
}

export function BookingForm({ shipRef, partners, d }: { shipRef: string; partners: Option[]; d: { partnerId?: string; number?: string; vessel?: string | null; voyage?: string | null; master?: string | null; house?: string | null; etd?: string | null; eta?: string | null } }) {
  return (
    <Folded summary={d.number ? 'Edit the booking' : 'Record the booking'}>
      <ActionForm action={A.saveBookingAction} submit="Save the booking" done="Booking saved">
        <Hidden name="ref" value={shipRef} />
        <L label="Carrier or forwarder"><Select name="partnerId" defaultValue={d.partnerId} options={partners} /></L>
        <L label="Booking number"><Input name="number" defaultValue={d.number} required /></L>
        <Row>
          <L label="Vessel or flight"><Input name="vessel" defaultValue={d.vessel ?? ''} /></L>
          <L label="Voyage"><Input name="voyage" defaultValue={d.voyage ?? ''} /></L>
        </Row>
        <Row>
          <L label="Master B/L or AWB"><Input name="masterDocument" defaultValue={d.master ?? ''} /></L>
          <L label="House B/L or AWB"><Input name="houseDocument" defaultValue={d.house ?? ''} /></L>
        </Row>
        <Row>
          <L label="ETD"><Input name="etd" type="date" defaultValue={d.etd ?? ''} /></L>
          <L label="ETA"><Input name="eta" type="date" defaultValue={d.eta ?? ''} /></L>
        </Row>
        <Row>
          <L label="Documents cut-off"><Input name="docsCutoff" type="datetime-local" /></L>
          <L label="Cargo cut-off"><Input name="cargoCutoff" type="datetime-local" /></L>
        </Row>
        <L label="VGM cut-off"><Input name="vgmCutoff" type="datetime-local" /></L>
      </ActionForm>
    </Folded>
  );
}

export function MilestoneForm({ shipRef, code }: { shipRef: string; code?: string }) {
  const o = useOpts();
  return (
    <Folded summary={code ? 'Update' : 'Record a milestone'}>
      <ActionForm action={A.setMilestoneAction} submit="Save" done="Milestone saved">
        <Hidden name="ref" value={shipRef} />
        <L label="Milestone"><Select name="code" defaultValue={code} options={o(MILESTONE_CODES, MILESTONE_LABEL)} /></L>
        <Row>
          <L label="Planned on"><Input name="plannedOn" type="date" /></L>
          <L label="Actual on"><Input name="actualOn" type="date" /></L>
        </Row>
        <L label="Place"><Input name="place" /></L>
        <L label="New ETA announced"><Input name="eta" type="date" /></L>
        <L label="Note"><Textarea name="note" rows={2} /></L>
      </ActionForm>
    </Folded>
  );
}

// ── Customs and documents ────────────────────────────────────────────────────────────────────────────────────────────

export function CustomsForm({ shipRef, brokers, d }: { shipRef: string; brokers: Option[]; d: { procedure?: string; mrn?: string | null; lodgedOn?: string | null; exitOn?: string | null; exitCodexRef?: string | null; declarantId?: string | null } }) {
  const o = useOpts();
  return (
    <Folded summary="Customs declaration">
      <ActionForm action={A.saveCustomsAction} submit="Save" done="Customs saved">
        <Hidden name="ref" value={shipRef} />
        <L label="Procedure"><Select name="procedure" defaultValue={d.procedure ?? 'export'} options={o(CUSTOMS_PROCEDURES, CUSTOMS_PROCEDURE_LABEL)} /></L>
        <L label="Declarant"><Select name="declarantId" defaultValue={d.declarantId ?? ''} options={[{ value: '', label: '—' }, ...brokers]} /></L>
        <L label="MRN"><Input name="mrn" defaultValue={d.mrn ?? ''} maxLength={18} /></L>
        <Row>
          <L label="Lodged on"><Input name="lodgedOn" type="date" defaultValue={d.lodgedOn ?? ''} /></L>
          <L label="Exit on (EX-A)"><Input name="exitOn" type="date" defaultValue={d.exitOn ?? ''} /></L>
        </Row>
        <L label="Proof of exit in Codex"><Input name="exitCodexRef" defaultValue={d.exitCodexRef ?? ''} /></L>
      </ActionForm>
    </Folded>
  );
}

export function ComplianceForm({ shipRef, check, state }: { shipRef: string; check: ComplianceCheck; state: string }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Record" title={COMPLIANCE_CHECK_LABEL[check]}>
      <ActionForm action={A.setComplianceAction} submit="Save" done="Check recorded">
        <Hidden name="ref" value={shipRef} />
        <Hidden name="check" value={check} />
        <L label="Result"><Select name="state" defaultValue={state} options={o(CHECK_STATES, CHECK_STATE_LABEL)} /></L>
        <L label="Detail (list consulted, licence number…)"><Textarea name="detail" rows={2} /></L>
        <L label="Evidence in Codex"><Input name="evidence" /></L>
        <L label="Reason (required for a waiver)"><Textarea name="reason" rows={2} /></L>
        <p className={s.hint}>{t('Only the compliance role waives a check; an embargoed destination is never waived.')}</p>
      </ActionForm>
    </Folded>
  );
}

export function DocumentForm({ shipRef, kind, state }: { shipRef: string; kind: string; state: string }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Record" title={DOCUMENT_KIND_LABEL[kind as keyof typeof DOCUMENT_KIND_LABEL]}>
      <ActionForm action={A.setDocumentAction} submit="Save" done="Document recorded">
        <Hidden name="ref" value={shipRef} />
        <Hidden name="kind" value={kind} />
        <L label="State"><Select name="state" defaultValue={state === 'missing' ? 'received' : state} options={o(DOCUMENT_STATES, DOCUMENT_STATE_LABEL)} /></L>
        <Row>
          <L label="Number"><Input name="number" /></L>
          <L label="Issued on"><Input name="issuedOn" type="date" /></L>
        </Row>
        <L label="Codex reference"><Input name="codexRef" placeholder="SHP-…" /></L>
        <L label="Reason (not required, rejected)"><Textarea name="reason" rows={2} /></L>
        <p className={s.hint}>{t('Vector stores no file: the document is filed in Codex and referenced here.')}</p>
      </ActionForm>
    </Folded>
  );
}

export function GenerateDocButton({ shipRef, kind }: { shipRef: string; kind: string }) {
  return (
    <ActionForm action={A.generateDocumentAction} submit="Generate" done="Deposit in Codex queued" inline variant="secondary">
      <Hidden name="ref" value={shipRef} />
      <Hidden name="kind" value={kind} />
    </ActionForm>
  );
}

// ── Incidents and costs ──────────────────────────────────────────────────────────────────────────────────────────────

export function IncidentForm({ shipRef, partners, today }: { shipRef: string; partners: Option[]; today: string }) {
  const o = useOpts();
  const { t } = useI18n();
  return (
    <Folded summary="Report an incident">
      <ActionForm action={A.reportIncidentAction} submit="Report" done="Incident reported">
        <Hidden name="ref" value={shipRef} />
        <Row>
          <L label="Type"><Select name="type" options={o(INCIDENT_TYPES, INCIDENT_TYPE_LABEL)} /></L>
          <L label="Severity"><Select name="severity" options={o(SEVERITIES, SEVERITY_LABEL)} /></L>
        </Row>
        <Row>
          <L label="Occurred on"><Input name="occurredOn" type="date" defaultValue={today} required /></L>
          <L label="Place"><Input name="place" /></L>
        </Row>
        <L label="What happened"><Textarea name="description" rows={3} required /></L>
        <L label="Partner concerned"><Select name="partnerId" options={[{ value: '', label: '—' }, ...partners]} /></L>
        <L label="Photos in Codex"><Input name="photosCodexRef" /></L>
        <label className={s.check}><input type="checkbox" name="reservesWritten" /> {t('Reserves written on the consignment note')}</label>
        <p className={s.hint}>{t('A safety incident is also notified to Vigie (owner of HSE events).')}</p>
      </ActionForm>
    </Folded>
  );
}

export function IncidentUpdateForm({ incRef, to, partners }: { incRef: string; to: 'claimed' | 'settled' | 'rejected' | 'closed'; partners?: Option[] }) {
  const label = to === 'claimed' ? 'Send a claim' : to === 'settled' ? 'Record the settlement' : to === 'rejected' ? 'Claim rejected' : 'Close the incident';
  return (
    <Folded summary={label}>
      <ActionForm action={A.updateIncidentAction} submit={label} done="Incident updated">
        <Hidden name="incident" value={incRef} />
        <Hidden name="to" value={to} />
        {to === 'claimed' && (
          <>
            <Row>
              <L label="Amount claimed"><Input name="claimedAmount" inputMode="decimal" required /></L>
              <L label="Currency"><Input name="claimCurrency" defaultValue="EUR" maxLength={3} /></L>
            </Row>
            <L label="Sent on"><Input name="claimSentOn" type="date" required /></L>
            {partners && <L label="Sent to"><Select name="partnerId" options={[{ value: '', label: '—' }, ...partners]} /></L>}
          </>
        )}
        {to === 'settled' && <L label="Amount recovered"><Input name="recoveredAmount" inputMode="decimal" required /></L>}
        {to === 'closed' && <L label="Reason"><Textarea name="reason" rows={2} required /></L>}
      </ActionForm>
    </Folded>
  );
}

export function CostForm({ shipRef, partners }: { shipRef: string; partners: Option[] }) {
  const o = useOpts();
  return (
    <Folded summary="Add a cost line">
      <ActionForm action={A.addCostAction} submit="Add" done="Cost line added">
        <Hidden name="ref" value={shipRef} />
        <Row>
          <L label="Category"><Select name="category" options={o(COST_CATEGORIES, COST_CATEGORY_LABEL)} /></L>
          <L label="Currency"><Input name="currency" defaultValue="EUR" maxLength={3} /></L>
        </Row>
        <L label="Partner"><Select name="partnerId" options={[{ value: '', label: '—' }, ...partners]} /></L>
        <Row>
          <L label="Estimated"><Input name="estimated" inputMode="decimal" /></L>
          <L label="Quoted"><Input name="quoted" inputMode="decimal" /></L>
          <L label="Invoiced"><Input name="invoiced" inputMode="decimal" /></L>
        </Row>
        <Row>
          <L label="Invoice number"><Input name="invoiceNumber" /></L>
          <L label="Invoice date"><Input name="invoiceDate" type="date" /></L>
        </Row>
      </ActionForm>
    </Folded>
  );
}

export function InvoiceForm({ lineId, d }: { lineId: string; d: { invoiced: number | null; number: string | null; date: string | null } }) {
  const { t } = useI18n();
  return (
    <Folded summary={d.invoiced == null ? 'Record the invoice' : 'Reconcile'}>
      <ActionForm action={A.invoiceCostAction} submit="Save" done="Invoice recorded">
        <Hidden name="line" value={lineId} />
        <Row>
          <L label="Invoiced amount"><Input name="invoiced" inputMode="decimal" defaultValue={d.invoiced ?? ''} required /></L>
          <L label="Invoice number"><Input name="invoiceNumber" defaultValue={d.number ?? ''} required /></L>
        </Row>
        <L label="Invoice date"><Input name="invoiceDate" type="date" defaultValue={d.date ?? ''} required /></L>
        <label className={s.check}><input type="checkbox" name="reconcile" defaultChecked /> {t('Reconciled with the quote')}</label>
        <L label="Reason of the variance"><Textarea name="reason" rows={2} /></L>
      </ActionForm>
    </Folded>
  );
}

// ── Partners and reference lists ─────────────────────────────────────────────────────────────────────────────────────

export interface PartnerDefaults { id?: string; name?: string; kind?: string; country?: string; modes?: string[]; zones?: string[]; accreditations?: string | null; contactRole?: string | null; contactEmail?: string | null; contactPhone?: string | null }

export function PartnerForm({ d = {}, primary }: { d?: PartnerDefaults; primary?: boolean }) {
  const o = useOpts();
  return (
    <Folded summary={d.id ? 'Edit the partner' : 'New partner'} variant={primary ? 'primary' : 'secondary'}>
      <ActionForm action={A.savePartnerAction} submit="Save" done="Partner saved">
        {d.id && <Hidden name="id" value={d.id} />}
        <L label="Company name"><Input name="name" defaultValue={d.name} required /></L>
        <Row>
          <L label="Type"><Select name="kind" defaultValue={d.kind} options={o(PARTNER_KINDS, PARTNER_KIND_LABEL)} /></L>
          <L label="Country (ISO)"><Input name="country" defaultValue={d.country} maxLength={2} required /></L>
        </Row>
        <L label="Modes"><Checks name="modes" options={o(MODES, MODE_LABEL)} defaults={d.modes} /></L>
        <L label="Zones served"><Checks name="zones" options={o(ZONES, ZONE_LABEL)} defaults={d.zones} /></L>
        <L label="Accreditations (AEO, IATA, FIATA…)"><Input name="accreditations" defaultValue={d.accreditations ?? ''} /></L>
        <Row>
          <L label="Contact (function)"><Input name="contactRole" defaultValue={d.contactRole ?? ''} /></L>
          <L label="Professional e-mail"><Input name="contactEmail" type="email" defaultValue={d.contactEmail ?? ''} /></L>
        </Row>
        <L label="Phone"><Input name="contactPhone" defaultValue={d.contactPhone ?? ''} /></L>
      </ActionForm>
    </Folded>
  );
}

export function PartnerStateForm({ id, to }: { id: string; to: 'active' | 'suspended' | 'archived' }) {
  const label = to === 'active' ? 'Reactivate' : to === 'suspended' ? 'Suspend' : 'Archive';
  return (
    <Folded summary={label}>
      <ActionForm action={A.setPartnerStateAction} submit={label} done="Partner updated">
        <Hidden name="id" value={id} />
        <Hidden name="state" value={to} />
        <L label="Reason"><Textarea name="reason" rows={2} required={to !== 'active'} /></L>
      </ActionForm>
    </Folded>
  );
}

export function RateForm({ today }: { today: string }) {
  return (
    <Folded summary="Add an exchange rate">
      <ActionForm action={A.addRateAction} submit="Save" done="Rate saved">
        <Row>
          <L label="Currency"><Input name="currency" maxLength={3} required /></L>
          <L label="On"><Input name="on" type="date" defaultValue={today} required /></L>
        </Row>
        <L label="Units for 1 EUR"><Input name="perEur" inputMode="decimal" required /></L>
      </ActionForm>
    </Folded>
  );
}

export function CountryRiskForm({ countries }: { countries: Option[] }) {
  const o = useOpts();
  return (
    <Folded summary="Change a country risk">
      <ActionForm action={A.setCountryRiskAction} submit="Save" done="Country updated">
        <L label="Country"><Select name="code" options={countries} /></L>
        <L label="Risk"><Select name="risk" options={o(COUNTRY_RISKS, COUNTRY_RISK_LABEL)} /></L>
        <L label="Reason and source"><Textarea name="reason" rows={2} required /></L>
      </ActionForm>
    </Folded>
  );
}

export function HsCodeForm() {
  const { t } = useI18n();
  return (
    <Folded summary="Add an HS code">
      <ActionForm action={A.addHsCodeAction} submit="Save" done="HS code saved">
        <L label="HS code"><Input name="code" inputMode="numeric" required /></L>
        <L label="Customs description"><Textarea name="description" rows={2} required /></L>
        <L label="Dual-use control number"><Input name="dualUseCode" /></L>
        <label className={s.check}><input type="checkbox" name="validated" /> {t('Validated by the forwarder or customs')}</label>
      </ActionForm>
    </Folded>
  );
}

export function ThresholdsForm({ d }: { d: Record<string, number> }) {
  return (
    <Folded summary="Edit the thresholds" variant="primary">
      <ActionForm action={A.saveThresholdsAction} submit="Save" done="Thresholds saved">
        <L label="Award validated by the shipping manager above (EUR)"><Input name="award_approval_eur" defaultValue={d.award_approval_eur} inputMode="numeric" /></L>
        <Row>
          <L label="Competition above (EUR)"><Input name="competition_eur" defaultValue={d.competition_eur} inputMode="numeric" /></L>
          <L label="Minimum quotes"><Input name="min_quotes" defaultValue={d.min_quotes} inputMode="numeric" /></L>
        </Row>
        <Row>
          <L label="Invoice variance threshold (%)"><Input name="variance_pct" defaultValue={Math.round(d.variance_threshold * 1000) / 10} inputMode="decimal" /></L>
          <L label="Punctuality tolerance (days)"><Input name="tolerance_days" defaultValue={d.tolerance_days} inputMode="numeric" /></L>
        </Row>
        <L label="Heavy lift from (kg)"><Input name="heavy_lift_kg" defaultValue={d.heavy_lift_kg} inputMode="numeric" /></L>
      </ActionForm>
    </Folded>
  );
}
