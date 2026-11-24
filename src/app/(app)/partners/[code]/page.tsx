// A partner's sheet: identity, professional contacts, state, its shipments and its statistics over 12 months.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KeyValueList } from '@/components/app/KeyValueList';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { EmptyState } from '@/components/app/EmptyState';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { can } from '@/domain/rights';
import { MODE_LABEL, PARTNER_KIND_LABEL, PARTNER_STATE_LABEL, ZONE_LABEL, type Mode, type PartnerKind, type PartnerState, type Zone } from '@/domain/vocab';
import { PartnerForm, PartnerStateForm } from '@/features/shipping/forms';
import { partnerStats } from '@/features/shipping/partner-stats';
import { Notice } from '@/features/shipping/notice';
import { ShipmentTag } from '@/features/shipping/tags';
import { routeOf } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { fmtDate, fmtNum, fmtPct } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function PartnerPage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, { t, lang }, viewer, today] = await Promise.all([params, getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(viewer, today);
  const p = w.partners.find((x) => x.id === code);
  if (!p) notFound();
  const { views, stats, score } = partnerStats(w, p.id, today);
  const edit = can(viewer.roles, 'partners');
  return (
    <>
      <PageHeader
        screen="partner"
        title={p.name}
        crumbs={['Carriers and forwarders']}
        subtitle={`${t(PARTNER_KIND_LABEL[p.kind as PartnerKind])} · ${p.country} · ${t(PARTNER_STATE_LABEL[p.state as PartnerState])}`}
        primary={edit ? <PartnerForm d={{ id: p.id, name: p.name, kind: p.kind, country: p.country, modes: p.modes, zones: p.zones, accreditations: p.accreditations, contactRole: p.contactRole, contactEmail: p.contactEmail, contactPhone: p.contactPhone }} /> : undefined}
        actions={edit ? <>{p.state === 'active' ? <PartnerStateForm id={p.id} to="suspended" /> : <PartnerStateForm id={p.id} to="active" />}{p.state !== 'archived' && <PartnerStateForm id={p.id} to="archived" />}</> : undefined}
      />
      {p.stateReason && <Notice warn title={t(PARTNER_STATE_LABEL[p.state as PartnerState])}>{p.stateReason}</Notice>}
      <KpiGrid>
        <KpiTile label={t('Shipments (12 months)')} value={stats.shipments} />
        <KpiTile label={t('Punctuality')} value={fmtPct(stats.punctuality, lang)} />
        <KpiTile label={t('Incidents / 100')} value={fmtNum(stats.incidentsPer100, lang)} />
        <KpiTile label={t('Invoice variance')} value={fmtPct(stats.invoiceVariance, lang)} />
        <KpiTile label={t('Award rate')} value={fmtPct(stats.awardRate, lang)} />
        <KpiTile label={t('Score')} value={score ?? '—'} sub={score == null ? t('from 5 shipments') : undefined} />
      </KpiGrid>
      <div className={s.grid2}>
        <SectionCard title={t('Partner')}>
          <KeyValueList items={[
            { k: t('Modes'), v: p.modes.map((m) => t(MODE_LABEL[m as Mode])).join(', ') },
            { k: t('Zones served'), v: p.zones.map((z) => t(ZONE_LABEL[z as Zone])).join(', ') || '—' },
            { k: t('Accreditations'), v: p.accreditations ?? '—' },
            { k: t('Contact'), v: p.contactRole ?? '—' },
            { k: t('Professional e-mail'), v: p.contactEmail ?? '—' },
            { k: t('Phone'), v: p.contactPhone ?? '—' },
          ]} />
        </SectionCard>
        <SectionCard title={t('Its shipments')}>
          {views.length ? (
            <Table size={12.5}>
              <thead><tr><Th>{t('Shipment')}</Th><Th>{t('Route')}</Th><Th>{t('State')}</Th><Th>{t('Delivered on')}</Th></tr></thead>
              <tbody>{views.map((v) => <tr key={v.s.id}><Td><Link href={`/shipments/${v.s.ref}`}>{v.s.ref}</Link></Td><Td>{routeOf(v)}</Td><Td><ShipmentTag state={v.s.state} t={t} /></Td><Td nowrap>{fmtDate(v.s.deliveredOn, lang)}</Td></tr>)}</tbody>
            </Table>
          ) : <EmptyState>{t('No shipment over 12 months.')}</EmptyState>}
        </SectionCard>
      </div>
    </>
  );
}
