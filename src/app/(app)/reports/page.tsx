// Reports and exports (docs/spec/04 § 4): the indicators over a period (?from=&to=, default the last 12 months) and by mode,
// computed on this read from the shipments, never stored; the CSV exports of every list.
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { ActionLink } from '@/components/app/ActionForm';
import { Button } from '@norma/charte/ds/Button';
import { Field, Input } from '@norma/charte/ds/Field';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { kpis } from '@/domain/kpi';
import { canSeeValues } from '@/domain/rights';
import { MODES, MODE_LABEL } from '@/domain/vocab';
import { kpiRows } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { addDaysIso } from '@/lib/dates';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(viewer, today);
  const from = DAY.test(sp.from ?? '') ? sp.from! : addDaysIso(today, -365);
  const to = DAY.test(sp.to ?? '') ? sp.to! : today;
  const inPeriod = w.shipments.filter((v) => { const d = v.s.atd ?? v.s.etd ?? v.s.readyOn ?? today; return d >= from && d <= to; });
  const rows = kpiRows(inPeriod);
  const k = kpis(rows);
  const values = canSeeValues(viewer.roles);
  return (
    <>
      <PageHeader screen="reports" crumbs={['Analysis']}
        primary={<ActionLink href="/export/shipments" label={t('Shipments (CSV)')} icon="download" download />}
        actions={<>
          <ActionLink href="/export/requests" label={t('Requests (CSV)')} icon="download" download />
          {values && <ActionLink href="/export/costs" label={t('Costs (CSV)')} icon="download" download />}
          <ActionLink href="/export/incidents" label={t('Incidents (CSV)')} icon="download" download />
          <ActionLink href="/export/partners" label={t('Partners (CSV)')} icon="download" download />
        </>}
      />
      <SectionCard>
        <form method="get" className={s.toolbar}>
          <Field label={t('From')}><Input type="date" name="from" size="sm" defaultValue={from} /></Field>
          <Field label={t('To')}><Input type="date" name="to" size="sm" defaultValue={to} /></Field>
          <Button type="submit" size="sm" variant="secondary">{t('Compute')}</Button>
          <span className={s.muted}>{t('Shipments departed (or planned) in the period.')} {inPeriod.length}</span>
        </form>
      </SectionCard>
      <KpiGrid>
        <KpiTile label={t('Delivered')} value={k.delivered} />
        <KpiTile label={t('On time (OTD)')} value={fmtPct(k.otd, lang)} sub={t('by the date of need')} />
        <KpiTile label={t('Carrier punctuality (OTIF)')} value={fmtPct(k.otif, lang)} sub={t('by the confirmed ETA, complete')} />
        <KpiTile label={t('Request to departure')} value={k.medianRequestToDeparture != null ? `${k.medianRequestToDeparture} ${t('d')}` : '—'} sub={t('median')} />
        <KpiTile label={t('Air and express share')} value={fmtPct(k.airShareKg, lang)} sub={t('of the chargeable weight')} />
        <KpiTile label={t('Incidents / 100')} value={fmtNum(k.incidentsPer100, lang)} />
        {values && <KpiTile label={t('Freight / value of goods')} value={fmtPct(k.freightOverValue, lang)} />}
        {values && <KpiTile label={t('Invoice variance')} value={fmtPct(k.invoiceVariance, lang)} sub={t('invoiced vs quoted')} />}
      </KpiGrid>
      <SectionCard title={t('By mode')}>
        <Table size={12.5}>
          <thead><tr><Th>{t('Mode')}</Th><Th>{t('Shipments')}</Th><Th>{t('Chargeable weight')}</Th><Th>{t('Median transit')}</Th>{values && <Th>{t('Cost per chargeable kg')}</Th>}</tr></thead>
          <tbody>
            {MODES.filter((m) => rows.some((r) => r.mode === m)).map((m) => (
              <tr key={m}>
                <Td>{t(MODE_LABEL[m])}</Td>
                <Td numeric>{rows.filter((r) => r.mode === m).length}</Td>
                <Td numeric>{fmtNum(rows.filter((r) => r.mode === m).reduce((n, r) => n + r.chargeableKg, 0), lang, 0)} kg</Td>
                <Td numeric>{k.transitByMode[m] != null ? `${k.transitByMode[m]} ${t('d')}` : '—'}</Td>
                {values && <Td numeric>{k.costPerKgByMode[m] != null ? fmtMoney(k.costPerKgByMode[m]!, 'EUR', lang) : '—'}</Td>}
              </tr>
            ))}
          </tbody>
        </Table>
        <p className={s.muted}>{t('Every indicator is computed from the shipments on each read, never stored. CO₂ estimates wait for question D-13.')}</p>
      </SectionCard>
    </>
  );
}
