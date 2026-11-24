// Incidents and claims (docs/spec/04 § 1): every incident of the shipments the viewer sees, open first, with the claim deadline
// of the transport convention (CMR, Montreal, Hague-Visby) and the claim's progress.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { KpiGrid, KpiTile } from '@/components/app/Kpi';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { noticeDeadline, regimeOf, timeBar } from '@/domain/claims';
import { can } from '@/domain/rights';
import { INCIDENT_TYPE_LABEL, type IncidentType, type Mode } from '@/domain/vocab';
import { IncidentUpdateForm } from '@/features/shipping/forms';
import { IncidentTag, SeverityTag } from '@/features/shipping/tags';
import { partnerOptions } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { fmtDate, fmtMoney } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function IncidentsPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(viewer, today);
  const rows = w.shipments.flatMap((v) => v.incidents.map((i) => ({ v, i }))).sort((a, b) => (a.i.state === 'open' ? 0 : a.i.state === 'claimed' ? 1 : 2) - (b.i.state === 'open' ? 0 : b.i.state === 'claimed' ? 1 : 2) || b.i.occurredOn.localeCompare(a.i.occurredOn));
  const canTrack = can(viewer.roles, 'track');
  const claimed = rows.filter((r) => r.i.claimedAmount != null);
  const recovered = claimed.reduce((n, r) => n + (r.i.recoveredAmount ?? 0), 0);
  return (
    <>
      <PageHeader screen="incidents" crumbs={['Shipping']} />
      <KpiGrid>
        <KpiTile label={t('Open')} value={rows.filter((r) => r.i.state === 'open').length} tone="alert" />
        <KpiTile label={t('Claims in progress')} value={rows.filter((r) => r.i.state === 'claimed').length} />
        <KpiTile label={t('Recovered')} value={fmtMoney(recovered, 'EUR', lang)} sub={t('settled claims')} />
      </KpiGrid>
      <SectionCard title={t('Incidents')}>
        {rows.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('Incident')}</Th><Th>{t('Shipment')}</Th><Th>{t('Type')}</Th><Th>{t('Severity')}</Th><Th>{t('Reserves by')}</Th><Th>{t('Time bar')}</Th><Th>{t('Claim')}</Th><Th>{t('State')}</Th><Th /></tr></thead>
            <tbody>
              {rows.map(({ v, i }) => {
                const regime = regimeOf(v.s.mode as Mode);
                const notice = noticeDeadline(regime, i.type as IncidentType, v.s.deliveredOn ?? i.occurredOn);
                return (
                  <tr key={i.id}>
                    <Td><span className={s.ref}>{i.ref}</span> · {fmtDate(i.occurredOn, lang)}<div className={s.muted}>{i.description}</div><div className={s.muted}>{t('Reported by')} {i.reportedByName}</div></Td>
                    <Td><Link href={`/shipments/${v.s.ref}?tab=incidents`}>{v.s.ref}</Link><div className={s.muted}>{v.carrierName ?? ''}</div></Td>
                    <Td>{t(INCIDENT_TYPE_LABEL[i.type as IncidentType])}</Td>
                    <Td><SeverityTag severity={i.severity} t={t} /></Td>
                    <Td nowrap>{notice ? fmtDate(notice, lang) : '—'}{notice && notice < today && i.state === 'open' && !i.reservesWritten && <div className={s.muted}>{t('Passed')}</div>}</Td>
                    <Td nowrap>{fmtDate(timeBar(regime, v.s.deliveredOn ?? i.occurredOn), lang)}</Td>
                    <Td>{i.claimedAmount != null ? fmtMoney(i.claimedAmount, i.claimCurrency ?? 'EUR', lang) : '—'}{i.recoveredAmount != null && <div className={s.muted}>{t('recovered')} {fmtMoney(i.recoveredAmount, i.claimCurrency ?? 'EUR', lang)}</div>}</Td>
                    <Td><IncidentTag state={i.state} t={t} /></Td>
                    <Td nowrap>
                      {canTrack && i.state === 'open' && <IncidentUpdateForm incRef={i.ref} to="claimed" partners={partnerOptions(w)} />}
                      {canTrack && i.state === 'claimed' && <IncidentUpdateForm incRef={i.ref} to="settled" />}
                      {canTrack && i.state !== 'closed' && <IncidentUpdateForm incRef={i.ref} to="closed" />}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <EmptyState>{t('No incident.')}</EmptyState>}
      </SectionCard>
    </>
  );
}
