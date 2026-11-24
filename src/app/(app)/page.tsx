// Home (docs/spec/06 § 2): the shipping manager's day — shipments in progress, forecast delays, cut-offs and departures of
// the coming days, documents late, requests waiting for triage, open incidents, and the month's freight costs.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { ActionLink } from '@/components/app/ActionForm';
import { cutoffSoon } from '@/domain/eta';
import { kpis } from '@/domain/kpi';
import { can, canSeeValues } from '@/domain/rights';
import { isOpenState } from '@/domain/shipment-state';
import { MODE_LABEL, type Mode, type ShipmentState } from '@/domain/vocab';
import { NewRequestForm } from '@/features/shipping/forms';
import { kpiRows, siteOptions } from '@/features/shipping/view-helpers';
import { RequestTag, ShipmentTag, UrgencyTag, LateTag } from '@/features/shipping/tags';
import s from '@/features/shipping/pages.module.css';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
import { addDaysIso } from '@/lib/dates';
import { businessNow, businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';
import { INCOTERMS } from '@/domain/incoterms';

export default async function HomePage() {
  const [{ t, lang }, viewer, today, now] = await Promise.all([getI18n(), getViewer(), businessToday(), businessNow()]);
  const w = await loadWorld(viewer, today);
  const values = canSeeValues(viewer.roles);
  const open = w.shipments.filter((v) => isOpenState(v.s.state as ShipmentState));
  const atRisk = open.filter((v) => v.late.atRisk);
  const k = kpis(kpiRows(w.shipments.filter((v) => (v.s.deliveredOn ?? today) >= addDaysIso(today, -365))));
  const week = addDaysIso(today, 14);
  const upcoming = w.shipments
    .flatMap((v) => [
      ...(v.s.etd && !v.s.atd && v.s.etd >= today && v.s.etd <= week && v.s.state !== 'cancelled' ? [{ v, on: v.s.etd, what: 'Departure' }] : []),
      ...(v.late.eta && !v.s.ata && v.late.eta >= today && v.late.eta <= week ? [{ v, on: v.late.eta, what: 'Arrival' }] : []),
      ...(v.booking?.docsCutoff && cutoffSoon(v.booking.docsCutoff, now, 24 * 14) ? [{ v, on: v.booking.docsCutoff.toISOString().slice(0, 10), what: 'Documents cut-off' }] : []),
      ...(v.booking?.cargoCutoff && cutoffSoon(v.booking.cargoCutoff, now, 24 * 14) ? [{ v, on: v.booking.cargoCutoff.toISOString().slice(0, 10), what: 'Cargo cut-off' }] : []),
    ])
    .sort((a, b) => a.on.localeCompare(b.on));
  const lateDocs = w.shipments.filter((v) => v.lateDocs > 0 && v.s.state !== 'cancelled');
  const toTriage = w.requests.filter((r) => r.state === 'submitted');
  const incidents = w.shipments.flatMap((v) => v.incidents.filter((i) => i.state === 'open' || i.state === 'claimed').map((i) => ({ v, i })));
  const month = today.slice(0, 7);
  const invoicedMonth = w.shipments.reduce((n, v) => n + v.costs.filter((c) => c.invoiceDate?.startsWith(month)).reduce((m, c) => m + (c.currency === 'EUR' ? c.invoiced ?? 0 : 0), 0), 0);
  const sites = siteOptions(w);
  const canRequest = can(viewer.roles, 'request');
  return (
    <>
      <PageHeader
        screen="home"
        title={t('Shipments at a glance')}
        primary={canRequest ? <NewRequestForm sites={sites} incoterms={INCOTERMS.map((i) => ({ value: i.code, label: `${i.code} — ${i.name}` }))} today={today} primary /> : undefined}
        actions={<ActionLink href="/shipments" label={t('All shipments')} />}
      />
      <KpiGrid>
        <KpiTile label={t('In progress')} value={open.length} sub={t('planned to arrived')} />
        <KpiTile label={t('Forecast late')} value={atRisk.length} tone={atRisk.length ? 'alert' : 'default'} sub={t('ETA after the date of need')} />
        <KpiTile label={t('Requests to triage')} value={toTriage.length} tone={toTriage.length ? 'alert' : 'default'} />
        <KpiTile label={t('Open incidents')} value={incidents.length} tone={incidents.length ? 'alert' : 'default'} />
        <KpiTile label={t('On time (12 months)')} value={fmtPct(k.otd, lang)} sub={t('delivered by the date of need')} />
        {values && <KpiTile label={t('Invoiced this month')} value={fmtMoney(invoicedMonth, 'EUR', lang)} sub={t('freight and related, in euros')} />}
      </KpiGrid>
      <div className={s.grid2}>
        <SectionCard title={t('Forecast late')} hint={t('Current ETA after the date of need of the request')}>
          {atRisk.length ? (
            <Table>
              <thead><tr><Th>{t('Shipment')}</Th><Th>{t('Needed on')}</Th><Th>{t('Current ETA')}</Th><Th>{t('Delay')}</Th></tr></thead>
              <tbody>
                {atRisk.map((v) => (
                  <tr key={v.s.id}>
                    <Td><Link href={`/shipments/${v.s.ref}`} className={s.ref}>{v.s.ref}</Link> <span className={s.muted}>{v.s.title}</span></Td>
                    <Td nowrap>{fmtDate(v.neededOn, lang)}</Td>
                    <Td nowrap>{fmtDate(v.late.eta, lang)}</Td>
                    <Td><LateTag days={v.late.forecastDays} t={t} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <EmptyState>{t('No shipment is forecast late')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Next 14 days')} hint={t('Departures, arrivals and cut-offs')}>
          {upcoming.length ? (
            <ul className={s.list}>
              {upcoming.slice(0, 12).map((u, n) => (
                <li key={n} className={s.item}>
                  <span><Link href={`/shipments/${u.v.s.ref}`} className={s.ref}>{u.v.s.ref}</Link> · {t(u.what)} · <span className={s.muted}>{t(MODE_LABEL[u.v.s.mode as Mode])}</span></span>
                  <span className={s.muted}>{fmtDate(u.on, lang)}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState>{t('Nothing in the next 14 days')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Requests to triage')} actions={<ActionLink href="/requests" label={t('All requests')} />}>
          {toTriage.length ? (
            <ul className={s.list}>
              {toTriage.map((r) => (
                <li key={r.id} className={s.item}>
                  <span><Link href={`/requests?sel=${r.ref}`} className={s.ref}>{r.ref}</Link> {r.title} <UrgencyTag urgency={r.urgency} t={t} /></span>
                  <span className={s.muted}>{t('needed on')} {fmtDate(r.neededOn, lang)} <RequestTag state={r.state} t={t} /></span>
                </li>
              ))}
            </ul>
          ) : <EmptyState>{t('No request waiting')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Documents late')} hint={t('Due at a stage the shipment has reached')}>
          {lateDocs.length ? (
            <ul className={s.list}>
              {lateDocs.map((v) => (
                <li key={v.s.id} className={s.item}>
                  <span><Link href={`/shipments/${v.s.ref}?tab=documents`} className={s.ref}>{v.s.ref}</Link> <ShipmentTag state={v.s.state} t={t} /></span>
                  <span className={s.muted}>{v.lateDocs} {t('late')} · {v.missingDocs} {t('missing')}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState>{t('No document is late')}</EmptyState>}
        </SectionCard>
        <SectionCard title={t('Open incidents')} actions={<ActionLink href="/incidents" label={t('All incidents')} />}>
          {incidents.length ? (
            <ul className={s.list}>
              {incidents.map(({ v, i }) => (
                <li key={i.id} className={s.item}>
                  <span><span className={s.ref}>{i.ref}</span> {i.description}</span>
                  <Link href={`/shipments/${v.s.ref}?tab=incidents`} className={s.muted}>{v.s.ref}</Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState>{t('No open incident')}</EmptyState>}
        </SectionCard>
      </div>
    </>
  );
}
