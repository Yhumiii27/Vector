// Shipment sheet (docs/spec/01–04): tabs Summary, Packing, Transport (RFQ, quotes, booking), Tracking (milestones), Customs &
// documents, Incidents, Costs, Journal (?tab=). Outside the viewer's scope: 404. Every figure is computed on this read.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { KeyValueList } from '@/components/app/KeyValueList';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { Notice } from '@/features/shipping/notice';
import { ActionLink } from '@/components/app/ActionForm';
import { Tag } from '@norma/charte/ds/Tag';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { noticeDeadline, regimeOf, REGIME_LABEL } from '@/domain/claims';
import { lcWarnings } from '@/domain/documents';
import { lateMilestones } from '@/domain/eta';
import { INCOTERMS, INCOTERM_BY_CODE, INCOTERM_STEPS, INCOTERM_STEP_LABEL, groupSteps } from '@/domain/incoterms';
import { fillRate } from '@/domain/packing';
import { rankQuotes } from '@/domain/quotes';
import { can, canSeeValues } from '@/domain/rights';
import type { Transition } from '@/domain/shipment-state';
import {
  COMPLIANCE_CHECKS, COMPLIANCE_CHECK_LABEL, COST_CATEGORY_LABEL, CUSTOMS_PROCEDURE_LABEL, DOCUMENT_DUE_LABEL, DOCUMENT_KIND_LABEL, FREIGHT_TYPE_LABEL,
  INCIDENT_TYPE_LABEL, INSURANCE_LABEL, LOAD_TYPE_LABEL, MILESTONE_CODES, MILESTONE_LABEL, MODE_LABEL, PACKAGE_TYPE_LABEL, PAYMENT_TERM_LABEL,
  REQUEST_ORIGIN_LABEL, type CostCategory, type CustomsProcedure, type DocumentKind, type FreightType, type IncidentType, type InsuranceKind, type LoadType,
  type MilestoneCode, type Mode, type PackageType, type PaymentTerm, type RequestOrigin,
} from '@/domain/vocab';
import {
  AwardForm, BookingForm, ComplianceForm, CostForm, CustomsForm, DocumentForm, GenerateDocButton, IncidentForm, IncidentUpdateForm, InvoiceForm, LineForm,
  LoadForm, MilestoneForm, PackageForm, QuoteForm, RfqForm, ShipmentDetailsForm, TransitionForm, ValidatePackingButton,
} from '@/features/shipping/forms';
import { CheckTag, DocTag, IncidentTag, QuoteTag, SeverityTag, ShipmentTag } from '@/features/shipping/tags';
import { partnerOptions, routeOf } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { addDaysIso } from '@/lib/dates';
import { fmtDate, fmtDays, fmtMoney, fmtNum, fmtPct, fmtInstant } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { auditEntries, packagingStandards } from '@/server/db/schema';
import { shipmentByRef } from '@/server/dal/world';
import { codexHref, keystoneProjectHref } from '@/server/integrations/codex/links';
import { getI18n, getViewer } from '@/server/session';

const TABS = [
  ['summary', 'Summary'], ['packing', 'Packing'], ['transport', 'Transport'], ['tracking', 'Tracking'], ['documents', 'Customs and documents'],
  ['incidents', 'Incidents'], ['costs', 'Costs'], ['journal', 'Journal'],
] as const;
type Tab = (typeof TABS)[number][0];

const DATED: Partial<Record<Transition, true>> = { pickup: true, depart: true, arrive: true, deliver: true };

const CodexRef = ({ codex }: { codex: string | null }) => {
  if (!codex) return <>—</>;
  const href = codexHref(codex);
  return href ? <a href={href} target="_blank" rel="noreferrer">{codex}</a> : <span>{codex}</span>;
};

export default async function ShipmentPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ code }, sp, { t, lang }, viewer, today] = await Promise.all([params, searchParams, getI18n(), getViewer(), businessToday()]);
  const found = await shipmentByRef(viewer, today, decodeURIComponent(code));
  if (!found) notFound();
  const { world: w, view: v } = found;
  const tab: Tab = (TABS.find(([k]) => k === sp.tab)?.[0] ?? 'summary') as Tab;
  const values = canSeeValues(viewer.roles);
  const canPrepare = can(viewer.roles, 'prepare');
  const canPack = can(viewer.roles, 'pack');
  const canTrack = can(viewer.roles, 'track');
  const canQuote = can(viewer.roles, 'quote');
  const closed = v.s.state === 'closed' || v.s.state === 'cancelled';
  const packingOpen = v.s.state === 'draft' || v.s.state === 'planned';
  const incoterms = INCOTERMS.map((i) => ({ value: i.code, label: `${i.code} — ${i.name}` }));
  const carriers = partnerOptions(w, ['carrier', 'forwarder', 'express']);
  const st = v.s.state;

  const actions = [];
  if (canTrack && v.next && !closed) actions.push(<TransitionForm key="next" shipRef={v.s.ref} transition={v.next} primary needsDate={DATED[v.next]} deliver={v.next === 'deliver'} />);
  if (canPrepare && !closed) actions.push(<ShipmentDetailsForm key="edit" incoterms={incoterms} d={{
    ref: v.s.ref, title: v.s.title, mode: v.s.mode, freightType: v.s.freightType, incoterm: v.s.incoterm, incotermPlace: v.s.incotermPlace, portOfLoading: v.s.portOfLoading,
    portOfDischarge: v.s.portOfDischarge, payment: v.s.payment, lcNumber: v.s.lcNumber, lcBank: v.s.lcBank, lcLatestShipment: v.s.lcLatestShipment, lcExpiry: v.s.lcExpiry,
    lcDocuments: v.s.lcDocuments, insurance: v.s.insurance, readyOn: v.s.readyOn, etd: v.s.etd, eta: v.s.eta, latestEta: v.s.latestEta,
  }} />);
  if (can(viewer.roles, 'incident') && !closed) actions.push(<IncidentForm key="inc" shipRef={v.s.ref} partners={partnerOptions(w)} today={today} />);
  if (canTrack && st === 'on_hold') actions.push(<TransitionForm key="resume" shipRef={v.s.ref} transition="resume" />);
  if (canTrack && ['planned', 'booked', 'picked_up', 'in_transit', 'arrived'].includes(st)) actions.push(<TransitionForm key="hold" shipRef={v.s.ref} transition="hold" />);
  if (canTrack && st === 'planned') actions.push(<TransitionForm key="reopen" shipRef={v.s.ref} transition="reopen" />);
  if (canTrack && ['draft', 'planned', 'booked'].includes(st)) actions.push(<TransitionForm key="cancel" shipRef={v.s.ref} transition="cancel" />);
  actions.push(<ActionLink key="print" href={`/print/shipments/${v.s.ref}/packing_list`} label={t('Print the packing list')} icon="print" newTab />);

  const tabLink = (k: Tab, label: string) => (
    <Link key={k} href={`/shipments/${v.s.ref}${k === 'summary' ? '' : `?tab=${k}`}`} className={`${s.tab} ${tab === k ? s.tabOn : ''}`} aria-current={tab === k ? 'page' : undefined}>
      {t(label)}
      {k === 'documents' && v.lateDocs ? ` · ${v.lateDocs}` : ''}
      {k === 'incidents' && v.openIncidents ? ` · ${v.openIncidents}` : ''}
    </Link>
  );

  return (
    <>
      <PageHeader
        screen="shipment"
        title={v.s.title}
        crumbs={['Shipments']}
        crumbData={v.s.ref}
        subtitle={<><ShipmentTag state={st} t={t} /> {routeOf(v)} · {t(MODE_LABEL[v.s.mode as Mode])} · {v.s.incoterm ?? '—'} {v.s.incotermPlace ?? ''}</>}
        actions={<>{actions}</>}
      />
      {v.s.stateReason && (st === 'on_hold' || st === 'cancelled') && <Notice warn title={t(st === 'on_hold' ? 'On hold' : 'Cancelled')}>{v.s.stateReason}</Notice>}
      {v.next && v.nextBlockers.length > 0 && !closed && (
        <Notice title={t('Before the next step')}>
          <ul className={s.blockers}>{v.nextBlockers.map((b) => <li key={b}>{t(b)}</li>)}</ul>
        </Notice>
      )}
      {v.incotermWarning && <Notice warn title={t('Incoterm')}>{t('A sea-only Incoterm (FAS, FOB, CFR, CIF) is used with another mode.')}</Notice>}
      <nav className={s.tabs} aria-label={t('Sections of the shipment')}>{TABS.map(([k, l]) => tabLink(k, l))}</nav>

      {tab === 'summary' && (
        <>
          <KpiGrid>
            <KpiTile label={t('Packages')} value={v.totals.packages} sub={`${fmtNum(v.totals.grossKg, lang, 0)} kg · ${fmtNum(v.totals.volumeM3, lang, 2)} m³`} />
            <KpiTile label={t('Chargeable weight')} value={`${fmtNum(v.chargeable.kg, lang, 0)} kg`} sub={v.chargeable.revenueTons != null ? `${fmtNum(v.chargeable.revenueTons, lang, 2)} ${t('revenue tons')}` : t(v.chargeable.basis === 'volume' ? 'volume decides' : 'weight decides')} />
            <KpiTile label={t('Current ETA')} value={fmtDate(v.s.ata ?? v.late.eta, lang)} sub={v.neededOn ? `${t('needed on')} ${fmtDate(v.neededOn, lang)}` : undefined} tone={v.late.atRisk ? 'alert' : 'default'} />
            <KpiTile label={t('Delay')} value={fmtDays(v.late.actualDays ?? v.late.forecastDays)} tone={v.late.atRisk ? 'alert' : 'default'} />
            <KpiTile label={t('Documents')} value={`${v.checklist.length - v.missingDocs} / ${v.checklist.length}`} sub={v.lateDocs ? `${v.lateDocs} ${t('late')}` : undefined} tone={v.lateDocs ? 'alert' : 'default'} />
            {values && <KpiTile label={t('Value of the goods')} value={fmtMoney(v.valueEur, 'EUR', lang)} />}
          </KpiGrid>
          <div className={s.grid2}>
            <SectionCard title={t('Shipment')}>
              <KeyValueList items={[
                { k: t('Departure'), v: v.from?.name ?? v.s.fromAddress ?? '—' },
                { k: t('Arrival'), v: v.to?.name ?? v.s.toAddress ?? '—' },
                { k: t('Mode'), v: `${t(MODE_LABEL[v.s.mode as Mode])}${v.s.freightType ? ` · ${t(FREIGHT_TYPE_LABEL[v.s.freightType as FreightType])}` : ''}` },
                { k: t('Ports'), v: `${v.s.portOfLoading ?? '—'} → ${v.s.portOfDischarge ?? '—'}` },
                { k: t('Incoterm'), v: v.s.incoterm ? `${v.s.incoterm} ${v.s.incotermPlace ?? ''}` : '—' },
                { k: t('Payment'), v: t(PAYMENT_TERM_LABEL[v.s.payment as PaymentTerm]) },
                { k: t('Insurance'), v: t(INSURANCE_LABEL[v.s.insurance as InsuranceKind]) },
                { k: t('Coordinator'), v: v.s.coordinatorName ?? '—' },
                { k: t('Carrier'), v: v.carrierName ?? '—' },
                { k: t('ETD / ATD'), v: `${fmtDate(v.s.etd, lang)} / ${fmtDate(v.s.atd, lang)}` },
                { k: t('ETA / ATA'), v: `${fmtDate(v.late.eta, lang)} / ${fmtDate(v.s.ata, lang)}` },
                { k: t('Delivered on'), v: fmtDate(v.s.deliveredOn, lang) },
              ]} />
            </SectionCard>
            <SectionCard title={t('Requests carried')}>
              <Table size={12.5}>
                <thead><tr><Th>{t('Request')}</Th><Th>{t('Origin')}</Th><Th>{t('Imputation')}</Th><Th>{t('Needed on')}</Th></tr></thead>
                <tbody>
                  {v.requests.map((r) => {
                    const k = keystoneProjectHref(r.projectCode);
                    return (
                      <tr key={r.id}>
                        <Td><span className={s.ref}>{r.ref}</span><div className={s.muted}>{r.title} · {r.requestedByName}</div></Td>
                        <Td>{t(REQUEST_ORIGIN_LABEL[r.origin as RequestOrigin])}</Td>
                        <Td>{r.projectCode ? (k ? <a href={k}>{r.projectCode}</a> : r.projectCode) : r.costCode}{r.orderRef ? <div className={s.muted}>{r.orderRef}</div> : null}</Td>
                        <Td nowrap>{fmtDate(r.neededOn, lang)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </SectionCard>
            <SectionCard title={t('Incoterm: what the group organises')} hint={v.s.incoterm ? INCOTERM_BY_CODE[v.s.incoterm]?.name : undefined}>
              {v.s.incoterm ? (
                <ul className={s.list}>
                  {INCOTERM_STEPS.map((step) => {
                    const mine = groupSteps(v.s.incoterm!, v.requests.some((r) => r.origin === 'purchase_order') ? 'buyer' : 'seller').includes(step);
                    return <li key={step} className={s.item}><span>{t(INCOTERM_STEP_LABEL[step])}</span><Tag tone={mine ? 'accent' : 'neutral'}>{t(mine ? 'Group' : 'Other party')}</Tag></li>;
                  })}
                </ul>
              ) : <EmptyState>{t('No Incoterm yet.')}</EmptyState>}
            </SectionCard>
            {v.s.payment === 'letter_of_credit' && (
              <SectionCard title={t('Letter of credit')}>
                <KeyValueList items={[
                  { k: t('Number'), v: v.s.lcNumber ?? '—' }, { k: t('Issuing bank'), v: v.s.lcBank ?? '—' },
                  { k: t('Latest shipment date'), v: fmtDate(v.s.lcLatestShipment, lang) }, { k: t('Expiry'), v: fmtDate(v.s.lcExpiry, lang) },
                  { k: t('Documents asked for'), v: v.s.lcDocuments.map((k) => t(DOCUMENT_KIND_LABEL[k as DocumentKind])).join(', ') || '—' },
                ]} />
                {lcWarnings({ latestShipment: v.s.lcLatestShipment, expiry: v.s.lcExpiry }, v.s.atd, v.s.etd, today).map((x) => <Notice key={x} warn>{t(x)}</Notice>)}
              </SectionCard>
            )}
          </div>
        </>
      )}

      {tab === 'packing' && (
        <>
          <SectionCard
            title={t('Packing list')}
            hint={v.s.packingValidatedAt ? `${t('Validated on')} ${fmtInstant(v.s.packingValidatedAt, lang)}` : t('Not validated')}
            actions={<>
              {canPack && packingOpen && <PackageForm shipRef={v.s.ref} loads={v.loads.map((l) => ({ value: String(l.number), label: `${l.number} · ${t(LOAD_TYPE_LABEL[l.type as LoadType])}` }))} packaging={(await (await getDb()).select().from(packagingStandards)).map((p) => ({ value: p.code, label: `${p.code} (${p.lengthCm}×${p.widthCm}×${p.heightCm})` }))} />}
              {canPack && packingOpen && v.packages.length > 0 && <LineForm shipRef={v.s.ref} packages={v.packages.map((p) => ({ value: String(p.number), label: `${p.number} · ${p.description}` }))} />}
              {canPrepare && packingOpen && !v.s.packingValidatedAt && v.packages.length > 0 && <ValidatePackingButton shipRef={v.s.ref} />}
            </>}
          >
            {v.packages.length ? (
              <Table size={12.5}>
                <thead><tr><Th>{t('No.')}</Th><Th>{t('Type')}</Th><Th>{t('Description and content')}</Th><Th>{t('L × W × H (cm)')}</Th><Th>{t('Volume')}</Th><Th>{t('Gross')}</Th><Th>{t('Net')}</Th><Th>{t('Load')}</Th></tr></thead>
                <tbody>
                  {v.packages.map((p) => (
                    <tr key={p.id}>
                      <Td numeric>{p.number}</Td>
                      <Td nowrap>{t(PACKAGE_TYPE_LABEL[p.type as PackageType])}{p.oog && <> <Tag tone="accent-2">{t('Out of gauge')}</Tag></>}{p.heavy && <> <Tag tone="accent">{t('Heavy lift')}</Tag></>}{!p.stackable && <> <Tag tone="outline">{t('Do not stack')}</Tag></>}</Td>
                      <Td>
                        {p.description}
                        {p.lines.map((l) => (
                          <div key={l.id} className={s.muted}>
                            {fmtNum(l.quantity, lang, 3)} × {l.description} · {t('HS')} {l.hsCode ?? '—'} · {l.originCountry ?? '—'}{values ? ` · ${fmtMoney(l.unitValue * l.quantity, l.currency, lang)}` : ''}
                            {l.unNumber && <> · <Tag tone="accent" size="sm">{l.unNumber} {t('class')} {l.dgClass}</Tag></>}
                            {l.dualUseCode && <> · <Tag tone="accent-2" size="sm">{t('Dual use')} {l.dualUseCode}</Tag></>}
                          </div>
                        ))}
                      </Td>
                      <Td nowrap>{p.lengthCm} × {p.widthCm} × {p.heightCm}</Td>
                      <Td numeric>{fmtNum(p.volumeM3, lang, 3)} m³</Td>
                      <Td numeric>{fmtNum(p.grossKg, lang)} kg</Td>
                      <Td numeric>{fmtNum(p.netKg, lang)} kg</Td>
                      <Td>{v.loads.find((l) => l.id === p.loadId)?.number ?? '—'}</Td>
                    </tr>
                  ))}
                  <tr>
                    <Td /><Td /><Td><strong>{t('Total')}</strong></Td><Td /><Td numeric><strong>{fmtNum(v.totals.volumeM3, lang, 3)} m³</strong></Td>
                    <Td numeric><strong>{fmtNum(v.totals.grossKg, lang)} kg</strong></Td><Td numeric><strong>{fmtNum(v.totals.netKg, lang)} kg</strong></Td><Td />
                  </tr>
                </tbody>
              </Table>
            ) : <EmptyState>{t('No package yet.')}</EmptyState>}
          </SectionCard>
          <div className={s.grid2}>
            <SectionCard title={t('Loads')} actions={canPrepare && !closed ? <LoadForm shipRef={v.s.ref} /> : undefined}>
              {v.loads.length ? (
                <ul className={s.list}>
                  {v.loads.map((l) => {
                    const pk = v.packages.filter((p) => p.loadId === l.id);
                    const f = fillRate(l.type as LoadType, pk.map((p) => ({ lengthCm: p.lengthCm, widthCm: p.widthCm, heightCm: p.heightCm, grossKg: p.grossKg, netKg: p.netKg })));
                    return (
                      <li key={l.id}>
                        <div className={s.item}><span><strong>{l.number}</strong> · {t(LOAD_TYPE_LABEL[l.type as LoadType])} {l.identifier ?? ''} {l.seal ? `· ${t('seal')} ${l.seal}` : ''}</span><span className={s.muted}>{pk.length} {t('packages')}</span></div>
                        {f.weight != null && (
                          <div className={s.muted}>
                            {t('Payload')} {fmtPct(f.weight, lang)}{f.volume != null ? ` · ${t('volume')} ${fmtPct(f.volume, lang)}` : ''}
                            <div className={s.bar}><div className={`${s.barFill} ${f.overweight ? s.barOver : ''}`} style={{ width: `${Math.min(100, Math.round((f.weight ?? 0) * 100))}%` }} /></div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : <EmptyState>{t('No load declared (loose cargo).')}</EmptyState>}
            </SectionCard>
            <SectionCard title={t('Customs summary per HS code')} hint={v.hs.missingHs ? `${v.hs.missingHs} ${t('lines without HS code')}` : undefined}>
              <Table size={12.5}>
                <thead><tr><Th>{t('HS code')}</Th><Th>{t('Origin')}</Th><Th>{t('Net weight')}</Th>{values && <Th>{t('Value')}</Th>}</tr></thead>
                <tbody>{v.hs.rows.map((r) => <tr key={`${r.hsCode}${r.originCountry}${r.currency}`}><Td>{r.hsCode}</Td><Td>{r.originCountry}</Td><Td numeric>{fmtNum(r.netKg, lang)} kg</Td>{values && <Td numeric>{fmtMoney(r.value, r.currency, lang)}</Td>}</tr>)}</tbody>
              </Table>
            </SectionCard>
          </div>
        </>
      )}

      {tab === 'transport' && (
        <div className={s.grid2}>
          <SectionCard title={t('Requests for quotation')} actions={canQuote && packingOpen ? <RfqForm shipRef={v.s.ref} partners={carriers} due={addDaysIso(today, 5)} /> : undefined}>
            {v.rfqs.length ? v.rfqs.map((r) => {
              const ranked = rankQuotes(r.quotes.map((q) => ({ id: q.id, partnerName: q.partnerName, amount: q.amount, currency: q.currency, transitDays: q.transitDays, validUntil: q.validUntil, state: q.state as never })), w.rates, today);
              return (
                <div key={r.id} style={{ marginBottom: 16 }}>
                  <div className={s.item}><span className={s.ref}>{r.ref}</span><span className={s.muted}>{t('answers by')} {fmtDate(r.dueOn, lang)} · {r.invited.length} {t('invited')}</span></div>
                  <Table size={12.5}>
                    <thead><tr><Th>{t('Partner')}</Th>{values && <Th>{t('Amount')}</Th>}{values && <Th>{t('In euros')}</Th>}<Th>{t('Transit')}</Th><Th>{t('Valid until')}</Th><Th>{t('State')}</Th><Th /></tr></thead>
                    <tbody>
                      {ranked.map((q) => (
                        <tr key={q.id}>
                          <Td>{q.partnerName} {q.cheapest && <Tag tone="outline" size="sm">{t('Cheapest')}</Tag>} {q.fastest && <Tag tone="outline" size="sm">{t('Fastest')}</Tag>}</Td>
                          {values && <Td numeric>{fmtMoney(q.amount, q.currency, lang)}</Td>}
                          {values && <Td numeric>{fmtMoney(q.eur, 'EUR', lang)}</Td>}
                          <Td numeric>{q.transitDays} {t('d')}</Td>
                          <Td nowrap>{fmtDate(q.validUntil, lang)}{q.expired && q.state === 'received' ? <> <Tag tone="accent-2" size="sm">{t('Expired')}</Tag></> : null}</Td>
                          <Td><QuoteTag state={q.state} t={t} /></Td>
                          <Td>{canQuote && r.state === 'sent' && q.state === 'received' && <AwardForm quoteId={q.id} label={`${t('Award')} · ${q.partnerName}`} />}</Td>
                        </tr>
                      ))}
                      {r.invited.filter((i) => !i.answeredAt).map((i) => <tr key={i.partnerId}><Td>{i.partnerName}</Td>{values && <Td />}{values && <Td />}<Td /><Td /><Td><Tag tone="neutral">{t('No answer yet')}</Tag></Td><Td /></tr>)}
                    </tbody>
                  </Table>
                  {canQuote && r.state === 'sent' && <QuoteForm rfqRef={r.ref} partners={r.invited.map((i) => ({ value: i.partnerId, label: i.partnerName }))} />}
                </div>
              );
            }) : <EmptyState>{t('No request for quotation yet.')}</EmptyState>}
          </SectionCard>
          <SectionCard title={t('Booking')} actions={canTrack && !closed ? <BookingForm shipRef={v.s.ref} partners={carriers} d={v.booking ? { partnerId: v.booking.partnerId, number: v.booking.number, vessel: v.booking.vessel, voyage: v.booking.voyage, master: v.booking.masterDocument, house: v.booking.houseDocument, etd: v.booking.etd, eta: v.booking.eta } : { partnerId: v.awarded?.partnerId }} /> : undefined}>
            {v.booking ? (
              <KeyValueList items={[
                { k: t('Carrier'), v: v.booking.partnerName }, { k: t('Booking number'), v: v.booking.number },
                { k: t('Vessel or flight'), v: [v.booking.vessel, v.booking.voyage].filter(Boolean).join(' · ') || '—' },
                { k: t('Master B/L or AWB'), v: v.booking.masterDocument ?? '—' }, { k: t('House B/L or AWB'), v: v.booking.houseDocument ?? '—' },
                { k: t('Documents cut-off'), v: v.booking.docsCutoff ? fmtInstant(v.booking.docsCutoff, lang) : '—' },
                { k: t('Cargo cut-off'), v: v.booking.cargoCutoff ? fmtInstant(v.booking.cargoCutoff, lang) : '—' },
                { k: t('ETD / ETA confirmed'), v: `${fmtDate(v.booking.etd, lang)} / ${fmtDate(v.booking.eta, lang)}` },
              ]} />
            ) : <EmptyState>{t('No booking yet.')}</EmptyState>}
          </SectionCard>
        </div>
      )}

      {tab === 'tracking' && (
        <SectionCard title={t('Milestones')} hint={`${t('Current ETA')} ${fmtDate(v.late.eta, lang)}`} actions={canTrack && !closed ? <MilestoneForm shipRef={v.s.ref} /> : undefined}>
          <ol className={s.timeline}>
            {MILESTONE_CODES.filter((c) => v.milestones.some((m) => m.code === c)).map((c) => {
              const m = v.milestones.find((x) => x.code === c)!;
              const late = lateMilestones([{ code: c, plannedOn: m.plannedOn, actualOn: m.actualOn }], today).length > 0;
              return (
                <li key={c} className={s.step}>
                  <span className={`${s.dot} ${m.actualOn ? s.dotDone : late ? s.dotLate : ''}`} aria-hidden />
                  <span>
                    <strong>{t(MILESTONE_LABEL[c as MilestoneCode])}</strong> {m.place ? <span className={s.muted}>· {m.place}</span> : null}
                    {m.source === 'tracking' && <> <Tag tone="outline" size="sm">{t('Tracking (simulation)')}</Tag></>}
                    {late && <> <Tag tone="accent-2" size="sm">{t('Late')}</Tag></>}
                    {m.note && <div className={s.muted}>{m.note}</div>}
                  </span>
                  <span className={s.muted}>{t('planned')} {fmtDate(m.plannedOn, lang)} · {t('actual')} {fmtDate(m.actualOn, lang)}</span>
                </li>
              );
            })}
          </ol>
          {!v.milestones.length && <EmptyState>{t('No milestone yet.')}</EmptyState>}
        </SectionCard>
      )}

      {tab === 'documents' && (
        <>
          <div className={s.grid2}>
            <SectionCard title={t('Export customs')} actions={canTrack && !closed ? <CustomsForm shipRef={v.s.ref} brokers={partnerOptions(w, ['customs_broker', 'forwarder'])} d={v.customs ?? {}} /> : undefined}>
              {v.customs ? (
                <KeyValueList items={[
                  { k: t('Procedure'), v: t(CUSTOMS_PROCEDURE_LABEL[v.customs.procedure as CustomsProcedure]) },
                  { k: t('Declarant'), v: w.partners.find((p) => p.id === v.customs!.declarantId)?.name ?? '—' },
                  { k: t('MRN'), v: v.customs.mrn ?? '—' }, { k: t('Lodged on'), v: fmtDate(v.customs.lodgedOn, lang) },
                  { k: t('Exit (EX-A)'), v: fmtDate(v.customs.exitOn, lang) }, { k: t('Proof of exit'), v: <CodexRef codex={v.customs.exitCodexRef} /> },
                ]} />
              ) : <EmptyState>{t('No customs declaration yet.')}</EmptyState>}
            </SectionCard>
            <SectionCard title={t('Export compliance')} hint={t(v.complianceOk ? 'Cleared' : 'To clear before booking')}>
              <Table size={12.5}>
                <tbody>
                  {COMPLIANCE_CHECKS.map((c) => {
                    const row = v.compliance.find((x) => x.check === c);
                    return (
                      <tr key={c}>
                        <Td>{t(COMPLIANCE_CHECK_LABEL[c])}{row?.detail && <div className={s.muted}>{row.detail}</div>}{row?.reason && <div className={s.muted}>{t('Waiver')}: {row.reason}</div>}</Td>
                        <Td nowrap><CheckTag state={row?.state ?? 'pending'} t={t} />{row?.byName && <div className={s.muted}>{row.byName}</div>}</Td>
                        <Td>{can(viewer.roles, 'comply') && !closed && <ComplianceForm shipRef={v.s.ref} check={c} state={row?.state ?? 'pending'} />}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </SectionCard>
          </div>
          <SectionCard title={t('Document checklist')} hint={t('Computed from the mode, the destination, the Incoterm, the goods and the payment')}>
            <Table size={12.5}>
              <thead><tr><Th>{t('Document')}</Th><Th>{t('Why')}</Th><Th>{t('Due')}</Th><Th>{t('State')}</Th><Th>{t('Codex')}</Th><Th /></tr></thead>
              <tbody>
                {v.checklist.map((l) => {
                  const rec = v.documents.find((d) => d.kind === l.kind);
                  return (
                    <tr key={l.kind}>
                      <Td>{t(DOCUMENT_KIND_LABEL[l.kind])}{rec?.number && <div className={s.muted}>{rec.number}</div>}{l.generated && <div className={s.muted}>{t('Generated by Vector')}</div>}</Td>
                      <Td tone="secondary">{t(l.why)}</Td>
                      <Td nowrap>{t(DOCUMENT_DUE_LABEL[l.due])}</Td>
                      <Td nowrap><DocTag state={l.state} late={l.late} t={t} />{rec?.reason && <div className={s.muted}>{rec.reason}</div>}</Td>
                      <Td><CodexRef codex={rec?.codexRef ?? null} /></Td>
                      <Td nowrap>
                        {canTrack && !closed && <DocumentForm shipRef={v.s.ref} kind={l.kind} state={l.state} />}
                        {canTrack && !closed && l.generated && <GenerateDocButton shipRef={v.s.ref} kind={l.kind} />}
                        {l.generated && <a href={`/print/shipments/${v.s.ref}/${l.kind}`} target="_blank" rel="noreferrer" className={s.muted}> {t('View')}</a>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </SectionCard>
        </>
      )}

      {tab === 'incidents' && (
        <SectionCard title={t('Incidents and claims')}>
          {v.incidents.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Incident')}</Th><Th>{t('Type')}</Th><Th>{t('Severity')}</Th><Th>{t('Claim deadline')}</Th><Th>{t('Claim')}</Th><Th>{t('State')}</Th><Th /></tr></thead>
              <tbody>
                {v.incidents.map((i) => {
                  const regime = regimeOf(v.s.mode as Mode);
                  const deadline = noticeDeadline(regime, i.type as IncidentType, v.s.deliveredOn ?? i.occurredOn);
                  return (
                    <tr key={i.id}>
                      <Td><span className={s.ref}>{i.ref}</span> · {fmtDate(i.occurredOn, lang)}<div className={s.muted}>{i.description}</div>{i.reservesWritten && <div className={s.muted}>{t('Reserves written on the consignment note')}</div>}</Td>
                      <Td>{t(INCIDENT_TYPE_LABEL[i.type as IncidentType])}</Td>
                      <Td><SeverityTag severity={i.severity} t={t} /></Td>
                      <Td nowrap>{deadline ? fmtDate(deadline, lang) : '—'}<div className={s.muted}>{t(REGIME_LABEL[regime])}</div></Td>
                      <Td>{i.claimedAmount != null ? `${fmtMoney(i.claimedAmount, i.claimCurrency ?? 'EUR', lang)}${i.recoveredAmount != null ? ` → ${fmtMoney(i.recoveredAmount, i.claimCurrency ?? 'EUR', lang)}` : ''}` : '—'}{i.partnerName && <div className={s.muted}>{i.partnerName}</div>}</Td>
                      <Td><IncidentTag state={i.state} t={t} /></Td>
                      <Td nowrap>
                        {canTrack && i.state === 'open' && <IncidentUpdateForm incRef={i.ref} to="claimed" partners={partnerOptions(w)} />}
                        {canTrack && i.state === 'claimed' && <IncidentUpdateForm incRef={i.ref} to="settled" />}
                        {canTrack && i.state === 'claimed' && <IncidentUpdateForm incRef={i.ref} to="rejected" />}
                        {canTrack && i.state !== 'closed' && <IncidentUpdateForm incRef={i.ref} to="closed" />}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : <EmptyState>{t('No incident on this shipment.')}</EmptyState>}
        </SectionCard>
      )}

      {tab === 'costs' && (values ? (
        <>
          <KpiGrid>
            <KpiTile label={t('Estimated')} value={fmtMoney(v.cost.estimatedEur, 'EUR', lang)} />
            <KpiTile label={t('Quoted')} value={fmtMoney(v.cost.quotedEur, 'EUR', lang)} />
            <KpiTile label={t('Invoiced')} value={fmtMoney(v.cost.invoicedEur, 'EUR', lang)} />
            <KpiTile label={t('Variance invoice / quote')} value={fmtPct(v.cost.variancePct, lang)} tone={v.cost.toExplain ? 'alert' : 'default'} sub={v.cost.toExplain ? `${v.cost.toExplain} ${t('to explain')}` : undefined} />
            <KpiTile label={t('Cost per chargeable kg')} value={v.chargeable.kg ? fmtMoney(Math.round(((v.cost.invoicedEur || v.cost.quotedEur) / v.chargeable.kg) * 100) / 100, 'EUR', lang) : '—'} />
          </KpiGrid>
          <SectionCard title={t('Cost lines')} actions={(canPrepare || can(viewer.roles, 'reconcile')) && <CostForm shipRef={v.s.ref} partners={partnerOptions(w)} />}>
            {v.costs.length ? (
              <Table size={12.5}>
                <thead><tr><Th>{t('Category')}</Th><Th>{t('Partner')}</Th><Th>{t('Estimated')}</Th><Th>{t('Quoted')}</Th><Th>{t('Invoiced')}</Th><Th>{t('Invoice')}</Th><Th>{t('Reconciled')}</Th><Th /></tr></thead>
                <tbody>
                  {v.costs.map((c) => (
                    <tr key={c.id}>
                      <Td>{t(COST_CATEGORY_LABEL[c.category as CostCategory])}</Td>
                      <Td>{c.partnerName ?? '—'}</Td>
                      <Td numeric>{fmtMoney(c.estimated, c.currency, lang)}</Td>
                      <Td numeric>{fmtMoney(c.quoted, c.currency, lang)}</Td>
                      <Td numeric>{fmtMoney(c.invoiced, c.currency, lang)}</Td>
                      <Td>{c.invoiceNumber ?? '—'}<div className={s.muted}>{fmtDate(c.invoiceDate, lang)}</div></Td>
                      <Td>{c.reconciled ? t('Yes') : t('No')}{c.varianceReason && <div className={s.muted}>{c.varianceReason}</div>}</Td>
                      <Td>{can(viewer.roles, 'reconcile') && !c.reconciled && <InvoiceForm lineId={c.id} d={{ invoiced: c.invoiced, number: c.invoiceNumber, date: c.invoiceDate }} />}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <EmptyState>{t('No cost line yet.')}</EmptyState>}
            <p className={s.muted}>{t('Imputation')}: {v.requests.map((r) => r.projectCode ?? r.costCode).join(', ')} · {t('a grouped shipment is shared by chargeable weight (D-7).')}</p>
          </SectionCard>
        </>
      ) : <EmptyState>{t('Costs are shown to the shipping team and finance only.')}</EmptyState>)}

      {tab === 'journal' && <ShipmentJournal id={v.s.id} lang={lang} t={t} />}
    </>
  );
}

async function ShipmentJournal({ id, lang, t }: { id: string; lang: 'fr' | 'en'; t: (s: string) => string }) {
  const db = await getDb();
  const rows = await db.select().from(auditEntries).where(eq(auditEntries.entityId, id)).orderBy(desc(auditEntries.occurredAt)).limit(200);
  return (
    <SectionCard title={t('Journal of the shipment')} hint={t('Append-only')}>
      {rows.length ? (
        <Table size={12.5}>
          <thead><tr><Th>{t('When')}</Th><Th>{t('Actor')}</Th><Th>{t('Change')}</Th><Th>{t('Reason')}</Th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><Td nowrap>{fmtInstant(r.occurredAt, lang)}</Td><Td>{r.actorName}</Td><Td>{r.change}</Td><Td tone="secondary">{r.reason ?? '—'}</Td></tr>)}</tbody>
        </Table>
      ) : <EmptyState>{t('Nothing recorded yet.')}</EmptyState>}
    </SectionCard>
  );
}
