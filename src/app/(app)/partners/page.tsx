// Carriers and forwarders (docs/spec/02 § 1): the directory and each partner's performance over 12 months (punctuality,
// incidents, invoice variance, answer to RFQs, score from 5 shipments) — computed, never stored.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { Tag } from '@norma/charte/ds/Tag';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { can } from '@/domain/rights';
import { MODE_LABEL, PARTNER_KIND_LABEL, PARTNER_STATE_LABEL, type Mode, type PartnerKind, type PartnerState } from '@/domain/vocab';
import { PartnerForm } from '@/features/shipping/forms';
import { partnerStats } from '@/features/shipping/partner-stats';
import s from '@/features/shipping/pages.module.css';
import { fmtNum, fmtPct } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function PartnersPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(viewer, today);
  return (
    <>
      <PageHeader screen="partners" crumbs={['Partners and customs']} primary={can(viewer.roles, 'partners') ? <PartnerForm primary /> : undefined} />
      <SectionCard title={t('Directory')} hint={`${w.partners.length}`}>
        <Table size={12.5}>
          <thead><tr><Th>{t('Partner')}</Th><Th>{t('Type')}</Th><Th>{t('Modes')}</Th><Th>{t('Shipments (12 months)')}</Th><Th>{t('Punctuality')}</Th><Th>{t('Incidents / 100')}</Th><Th>{t('Invoice variance')}</Th><Th>{t('RFQ answer')}</Th><Th>{t('Score')}</Th><Th>{t('State')}</Th></tr></thead>
          <tbody>
            {w.partners.map((p) => {
              const { stats, score } = partnerStats(w, p.id, today);
              return (
                <tr key={p.id}>
                  <Td><Link href={`/partners/${p.id}`}>{p.name}</Link><div className={s.muted}>{p.country}{p.accreditations ? ` · ${p.accreditations}` : ''}</div></Td>
                  <Td>{t(PARTNER_KIND_LABEL[p.kind as PartnerKind])}</Td>
                  <Td>{p.modes.map((m) => t(MODE_LABEL[m as Mode])).join(', ')}</Td>
                  <Td numeric>{stats.shipments}</Td>
                  <Td numeric>{fmtPct(stats.punctuality, lang)}</Td>
                  <Td numeric>{fmtNum(stats.incidentsPer100, lang)}</Td>
                  <Td numeric>{fmtPct(stats.invoiceVariance, lang)}</Td>
                  <Td numeric>{stats.answerHours != null ? `${stats.answerHours} h` : '—'}{stats.answerRate != null && <div className={s.muted}>{fmtPct(stats.answerRate, lang)}</div>}</Td>
                  <Td numeric>{score ?? <span className={s.muted}>{t('too few')}</span>}</Td>
                  <Td>{p.state === 'active' ? <Tag tone="outline">{t(PARTNER_STATE_LABEL.active)}</Tag> : <Tag tone="accent-2">{t(PARTNER_STATE_LABEL[p.state as PartnerState])}</Tag>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className={s.muted}>{t('The score (out of 100) weighs punctuality 40 %, incidents 25 %, invoice variance 20 % and responsiveness 15 % (question D-11), from 5 shipments.')}</p>
      </SectionCard>
    </>
  );
}
