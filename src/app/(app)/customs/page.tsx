// Customs and compliance (docs/spec/03): the shipments whose export checklist is not cleared, the HS codes in use (validated or
// not), and the country table (risk, origin document) kept by the compliance role.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Tag } from '@norma/charte/ds/Tag';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { can } from '@/domain/rights';
import { COMPLIANCE_CHECK_LABEL, COUNTRY_RISK_LABEL, ZONE_LABEL, type ComplianceCheck, type CountryRisk, type Zone } from '@/domain/vocab';
import { CountryRiskForm, HsCodeForm } from '@/features/shipping/forms';
import { CheckTag, ShipmentTag } from '@/features/shipping/tags';
import { routeOf } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { hsCodes } from '@/server/db/schema';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function CustomsPage() {
  const [{ t }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(viewer, today);
  const codes = await (await getDb()).select().from(hsCodes).orderBy(hsCodes.code);
  const pending = w.shipments.filter((v) => v.international && !v.complianceOk && !['closed', 'cancelled'].includes(v.s.state));
  const used = new Map<string, number>();
  for (const v of w.shipments) for (const p of v.packages) for (const l of p.lines) if (l.hsCode) used.set(l.hsCode, (used.get(l.hsCode) ?? 0) + 1);
  const comply = can(viewer.roles, 'comply');
  return (
    <>
      <PageHeader screen="customs" crumbs={['Partners and customs']} primary={comply ? <HsCodeForm /> : undefined} actions={comply ? <CountryRiskForm countries={w.countries.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))} /> : undefined} />
      <SectionCard title={t('Export compliance to clear')} hint={t('To clear before booking')}>
        {pending.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('Shipment')}</Th><Th>{t('Route')}</Th><Th>{t('Checks')}</Th></tr></thead>
            <tbody>
              {pending.map((v) => (
                <tr key={v.s.id}>
                  <Td><Link href={`/shipments/${v.s.ref}?tab=documents`}>{v.s.ref}</Link> <ShipmentTag state={v.s.state} t={t} /></Td>
                  <Td>{routeOf(v)}</Td>
                  <Td>{v.compliance.filter((c) => c.state === 'pending' || c.state === 'blocked').map((c) => <div key={c.check}>{t(COMPLIANCE_CHECK_LABEL[c.check as ComplianceCheck])} <CheckTag state={c.state} t={t} /></div>)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : <EmptyState>{t('Every international shipment is cleared.')}</EmptyState>}
      </SectionCard>
      <div className={s.grid2}>
        <SectionCard title={t('HS codes in use')} hint={t('Customs descriptions validated by the forwarder or customs (DA-3)')}>
          <Table size={12.5}>
            <thead><tr><Th>{t('HS code')}</Th><Th>{t('Description')}</Th><Th>{t('Lines')}</Th><Th>{t('State')}</Th></tr></thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.code}>
                  <Td>{c.code}</Td>
                  <Td>{c.description}{c.dualUseCode && <div><Tag tone="accent-2" size="sm">{t('Dual use')} {c.dualUseCode}</Tag></div>}</Td>
                  <Td numeric>{used.get(c.code) ?? 0}</Td>
                  <Td>{c.validated ? <Tag tone="outline">{t('Validated')}</Tag> : <Tag tone="accent-2">{t('To validate')}</Tag>}</Td>
                </tr>
              ))}
              {[...used.keys()].filter((k) => !codes.some((c) => c.code === k)).map((k) => <tr key={k}><Td>{k}</Td><Td tone="secondary">{t('Not in the list')}</Td><Td numeric>{used.get(k)}</Td><Td><Tag tone="accent-2">{t('To add')}</Tag></Td></tr>)}
            </tbody>
          </Table>
        </SectionCard>
        <SectionCard title={t('Countries')} hint={t('Risk and origin document, kept by the compliance role (DA-6)')}>
          <Table size={12.5}>
            <thead><tr><Th>{t('Country')}</Th><Th>{t('Zone')}</Th><Th>{t('EU')}</Th><Th>{t('Risk')}</Th><Th>{t('Origin document')}</Th></tr></thead>
            <tbody>
              {w.countries.map((c) => (
                <tr key={c.code}>
                  <Td>{c.name} <span className={s.muted}>{c.code}</span>{c.note && <div className={s.muted}>{c.note}</div>}</Td>
                  <Td>{t(ZONE_LABEL[c.zone as Zone])}</Td>
                  <Td>{c.eu ? t('Yes') : t('No')}</Td>
                  <Td>{c.risk === 'none' ? t(COUNTRY_RISK_LABEL.none) : <Tag tone={c.risk === 'embargoed' ? 'accent' : 'accent-2'}>{t(COUNTRY_RISK_LABEL[c.risk as CountryRisk])}</Tag>}</Td>
                  <Td>{c.originDocument === 'eur1' ? t('EUR.1 / origin declaration') : c.originDocument === 'certificate' ? t('Certificate of origin') : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </SectionCard>
      </div>
    </>
  );
}
