// Reference lists and thresholds (docs/spec/06): the award and competition thresholds, the variance and punctuality
// tolerances, the Incoterms, the packaging and cost standards, the exchange rates. Each change is journalled.
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { KeyValueList } from '@/components/app/KeyValueList';
import { ActionLink } from '@/components/app/ActionForm';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { INCOTERMS } from '@/domain/incoterms';
import { DEFAULT_AWARD_POLICY } from '@/domain/quotes';
import { HEAVY_LIFT_KG, VOLUMETRIC } from '@/domain/packing';
import { can } from '@/domain/rights';
import { MODE_LABEL, PACKAGE_TYPE_LABEL, ZONE_LABEL, type Mode, type PackageType, type Zone } from '@/domain/vocab';
import { RateForm, ThresholdsForm } from '@/features/shipping/forms';
import s from '@/features/shipping/pages.module.css';
import { fmtDate, fmtNum, fmtPct } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { appSettings, costStandards, exchangeRates, packagingStandards } from '@/server/db/schema';
import { getI18n, getViewer } from '@/server/session';

export default async function AdminPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const db = await getDb();
  const [settings, rates, packs, stds] = await Promise.all([db.select().from(appSettings), db.select().from(exchangeRates), db.select().from(packagingStandards), db.select().from(costStandards)]);
  const get = (k: string, d: number) => { const v = settings.find((x) => x.key === `vector.${k}`)?.value; return typeof v === 'number' ? v : d; };
  const th = {
    award_approval_eur: get('award_approval_eur', DEFAULT_AWARD_POLICY.approvalEur), competition_eur: get('competition_eur', DEFAULT_AWARD_POLICY.competitionEur),
    min_quotes: get('min_quotes', DEFAULT_AWARD_POLICY.minQuotes), variance_threshold: get('variance_threshold', 0.05), tolerance_days: get('tolerance_days', 1), heavy_lift_kg: get('heavy_lift_kg', HEAVY_LIFT_KG),
  };
  return (
    <>
      <PageHeader screen="admin" crumbs={['Administration']} primary={can(viewer.roles, 'reference') ? <ThresholdsForm d={th} /> : undefined}
        actions={<>{can(viewer.roles, 'reconcile') && <RateForm today={today} />}<ActionLink href="/admin/connectors" label={t('Connectors')} /></>} />
      <div className={s.grid2}>
        <SectionCard title={t('Thresholds')}>
          <KeyValueList items={[
            { k: t('Award validated by the shipping manager above'), v: `${fmtNum(th.award_approval_eur, lang, 0)} €` },
            { k: t('Competition required above'), v: `${fmtNum(th.competition_eur, lang, 0)} € · ${th.min_quotes} ${t('quotes')}` },
            { k: t('Invoice variance threshold'), v: fmtPct(th.variance_threshold, lang) },
            { k: t('Punctuality tolerance'), v: `${th.tolerance_days} ${t('d')}` },
            { k: t('Heavy lift from'), v: `${fmtNum(th.heavy_lift_kg, lang, 0)} kg` },
            { k: t('Volumetric factors'), v: `${t('air')} 1:6000 · ${t('express')} 1:5000 · ${t('road')} ${VOLUMETRIC.road} kg/m³ · ${t('sea')} 1 t = 1 m³` },
          ]} />
        </SectionCard>
        <SectionCard title={t('Exchange rates')} hint={t('Units for 1 EUR (question D-8)')}>
          <Table size={12.5}>
            <thead><tr><Th>{t('Currency')}</Th><Th>{t('On')}</Th><Th>{t('Rate')}</Th></tr></thead>
            <tbody>{rates.sort((a, b) => a.currency.localeCompare(b.currency) || b.on.localeCompare(a.on)).map((r) => <tr key={`${r.currency}${r.on}`}><Td>{r.currency}</Td><Td>{fmtDate(r.on, lang)}</Td><Td numeric>{fmtNum(r.perEur, lang, 4)}</Td></tr>)}</tbody>
          </Table>
        </SectionCard>
        <SectionCard title={t('Incoterms 2020')}>
          <Table size={12.5}><tbody>{INCOTERMS.map((i) => <tr key={i.code}><Td><strong>{i.code}</strong></Td><Td>{i.name}</Td><Td tone="secondary">{i.seaOnly ? t('Sea and inland waterway') : t('Any mode')}</Td></tr>)}</tbody></Table>
        </SectionCard>
        <SectionCard title={t('Packaging standards')} hint="DA-5">
          <Table size={12.5}>
            <thead><tr><Th>{t('Code')}</Th><Th>{t('Type')}</Th><Th>{t('L × W × H (cm)')}</Th><Th>{t('Tare')}</Th><Th>{t('Max')}</Th><Th>{t('Norm')}</Th></tr></thead>
            <tbody>{packs.map((p) => <tr key={p.code}><Td>{p.code}</Td><Td>{t(PACKAGE_TYPE_LABEL[p.type as PackageType])}</Td><Td nowrap>{p.lengthCm} × {p.widthCm} × {p.heightCm}</Td><Td numeric>{p.tareKg} kg</Td><Td numeric>{p.maxKg} kg</Td><Td>{p.norm ?? '—'}</Td></tr>)}</tbody>
          </Table>
        </SectionCard>
        <SectionCard title={t('Cost standards')} hint={t('Estimate of a request (DA-7)')}>
          <Table size={12.5}>
            <thead><tr><Th>{t('Mode')}</Th><Th>{t('Zone')}</Th><Th>{t('€ per chargeable kg')}</Th></tr></thead>
            <tbody>{stds.map((c) => <tr key={`${c.mode}${c.zone}`}><Td>{t(MODE_LABEL[c.mode as Mode])}</Td><Td>{t(ZONE_LABEL[c.zone as Zone])}</Td><Td numeric>{fmtNum(c.eurPerKg, lang, 3)}</Td></tr>)}</tbody>
          </Table>
        </SectionCard>
      </div>
    </>
  );
}
