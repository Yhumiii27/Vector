// Shipments (docs/spec/06 § 2): every shipment the viewer may see, filtered by state, mode and text in the URL
// (?state=open|late|all|<state>&mode=&q=), with the computed figures (packages, chargeable weight, ETA, delay, documents).
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { ActionLink } from '@/components/app/ActionForm';
import { Button } from '@norma/charte/ds/Button';
import { Field, Input, Select } from '@norma/charte/ds/Field';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { canSeeValues } from '@/domain/rights';
import { isOpenState } from '@/domain/shipment-state';
import { MODES, MODE_LABEL, SHIPMENT_STATES, SHIPMENT_STATE_LABEL, type Mode, type ShipmentState } from '@/domain/vocab';
import { LateTag, ShipmentTag } from '@/features/shipping/tags';
import { routeOf } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(viewer, today);
  const state = one(sp.state) || 'open';
  const mode = one(sp.mode);
  const q = one(sp.q).trim().toLowerCase();
  const values = canSeeValues(viewer.roles);
  const rows = w.shipments.filter((v) => {
    const st = v.s.state as ShipmentState;
    if (state === 'open' && !isOpenState(st) && st !== 'draft') return false;
    if (state === 'late' && !v.late.atRisk) return false;
    if (state !== 'open' && state !== 'late' && state !== 'all' && st !== state) return false;
    if (mode && v.s.mode !== mode) return false;
    if (q && !`${v.s.ref} ${v.s.title} ${routeOf(v)} ${v.requests.map((r) => `${r.ref} ${r.projectCode ?? ''} ${r.costCode ?? ''}`).join(' ')} ${v.carrierName ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const exportHref = `/export/shipments`;
  return (
    <>
      <PageHeader screen="shipments" crumbs={['Shipping']} primary={<ActionLink href="/requests" label={t('Shipment requests')} />} actions={<ActionLink href={exportHref} label={t('Export (CSV)')} icon="download" download />} />
      <SectionCard>
        <form method="get" className={s.toolbar}>
          <Field label={t('State')}>
            <Select name="state" size="sm" defaultValue={state} options={[
              { value: 'open', label: t('In progress and drafts') }, { value: 'late', label: t('Forecast late') }, { value: 'all', label: t('All') },
              ...SHIPMENT_STATES.map((x) => ({ value: x, label: t(SHIPMENT_STATE_LABEL[x]) })),
            ]} />
          </Field>
          <Field label={t('Mode')}>
            <Select name="mode" size="sm" defaultValue={mode} options={[{ value: '', label: t('All') }, ...MODES.map((m) => ({ value: m, label: t(MODE_LABEL[m]) }))]} />
          </Field>
          <Field label={t('Search')}><Input name="q" size="sm" defaultValue={one(sp.q)} placeholder={t('Reference, project, site, carrier')} /></Field>
          <Button type="submit" size="sm" variant="secondary">{t('Filter')}</Button>
        </form>
      </SectionCard>
      <SectionCard title={t('Shipments')} hint={`${rows.length}`}>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t('Shipment')}</Th><Th>{t('Route')}</Th><Th>{t('Mode')}</Th><Th>{t('State')}</Th><Th>{t('Packages')}</Th><Th>{t('Chargeable')}</Th>
                <Th>{t('ETD')}</Th><Th>{t('Current ETA')}</Th><Th>{t('Documents')}</Th>{values && <Th>{t('Cost')}</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.s.id}>
                  <Td><Link href={`/shipments/${v.s.ref}`} className={s.ref}>{v.s.ref}</Link><div className={s.muted}>{v.s.title}</div></Td>
                  <Td>{routeOf(v)}<div className={s.muted}>{v.s.incoterm ?? '—'} {v.s.incotermPlace ?? ''}</div></Td>
                  <Td nowrap>{t(MODE_LABEL[v.s.mode as Mode])}</Td>
                  <Td nowrap><ShipmentTag state={v.s.state} t={t} /> <LateTag days={v.late.forecastDays && v.late.atRisk ? v.late.forecastDays : null} t={t} /></Td>
                  <Td numeric>{v.totals.packages}<div className={s.muted}>{fmtNum(v.totals.grossKg, lang, 0)} kg</div></Td>
                  <Td numeric>{fmtNum(v.chargeable.kg, lang, 0)} kg</Td>
                  <Td nowrap>{fmtDate(v.s.atd ?? v.s.etd, lang)}</Td>
                  <Td nowrap>{fmtDate(v.s.ata ?? v.late.eta, lang)}</Td>
                  <Td nowrap>{v.missingDocs ? `${v.missingDocs} ${t('missing')}` : t('Complete')}</Td>
                  {values && <Td numeric>{fmtMoney(v.cost.invoicedEur || v.cost.quotedEur || v.cost.estimatedEur || null, 'EUR', lang)}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState>{t('No shipment matches these filters.')}</EmptyState>}
      </SectionCard>
    </>
  );
}
