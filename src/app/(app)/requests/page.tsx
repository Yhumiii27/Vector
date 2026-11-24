// Shipment requests (docs/spec/01 § 1): what has to go where, for when and for what. The shipping team triages the submitted
// ones (accept into a new or an open shipment, reject with a reason); a requester sees and follows their own.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { INCOTERMS } from '@/domain/incoterms';
import { can, canSeeValues } from '@/domain/rights';
import { REQUEST_ORIGIN_LABEL, type RequestOrigin } from '@/domain/vocab';
import { AcceptRequestForm, CloseRequestForm, NewRequestForm, SubmitRequestButton } from '@/features/shipping/forms';
import { RequestTag, UrgencyTag } from '@/features/shipping/tags';
import { siteOptions } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function RequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(viewer, today);
  const triage = can(viewer.roles, 'triage');
  const values = canSeeValues(viewer.roles);
  const groupable = w.shipments.filter((v) => v.s.state === 'draft' || v.s.state === 'planned').map((v) => ({ value: v.s.ref, label: `${v.s.ref} · ${v.s.title}` }));
  const shipmentOf = (id: string) => w.shipments.filter((v) => v.requests.some((r) => r.id === id)).map((v) => v.s.ref);
  const open = w.requests.filter((r) => r.state === 'draft' || r.state === 'submitted');
  const done = w.requests.filter((r) => r.state !== 'draft' && r.state !== 'submitted');
  const row = (r: (typeof w.requests)[number]) => (
    <tr key={r.id} style={sp.sel === r.ref ? { outline: '1px solid var(--color-accent)' } : undefined}>
      <Td><span className={s.ref}>{r.ref}</span> <UrgencyTag urgency={r.urgency} t={t} /><div className={s.muted}>{r.title}</div></Td>
      <Td>{t(REQUEST_ORIGIN_LABEL[r.origin as RequestOrigin])}<div className={s.muted}>{r.projectCode ?? r.costCode}{r.orderRef ? ` · ${r.orderRef}` : ''}</div></Td>
      <Td>{w.sites.find((x) => x.code === r.fromSite)?.name ?? r.fromAddress} → {w.sites.find((x) => x.code === r.toSite)?.name ?? r.toAddress}<div className={s.muted}>{r.fromCountry} → {r.toCountry}</div></Td>
      <Td nowrap>{fmtDate(r.readyOn, lang)} → {fmtDate(r.neededOn, lang)}</Td>
      <Td>{r.estimatedKg ? `${fmtNum(r.estimatedKg, lang, 0)} kg` : '—'}{values && r.estimatedValueEur ? <div className={s.muted}>{fmtMoney(r.estimatedValueEur, 'EUR', lang)}</div> : null}{r.dangerousGoods === 'yes' && <div className={s.muted}>{t('Dangerous goods')}</div>}</Td>
      <Td><RequestTag state={r.state} t={t} />{r.stateReason && <div className={s.muted}>{r.stateReason}</div>}{shipmentOf(r.id).map((x) => <div key={x}><Link href={`/shipments/${x}`}>{x}</Link></div>)}</Td>
      <Td nowrap>
        {r.state === 'draft' && (r.requestedById === viewer.userId || triage) && <SubmitRequestButton reqRef={r.ref} />}
        {r.state === 'submitted' && triage && <AcceptRequestForm reqRef={r.ref} groupable={groupable} />}
        {r.state === 'submitted' && triage && <CloseRequestForm reqRef={r.ref} to="rejected" />}
        {(r.state === 'draft' || r.state === 'submitted') && (r.requestedById === viewer.userId || triage) && <CloseRequestForm reqRef={r.ref} to="cancelled" />}
      </Td>
    </tr>
  );
  const head = <thead><tr><Th>{t('Request')}</Th><Th>{t('Origin')}</Th><Th>{t('Route')}</Th><Th>{t('Ready → needed')}</Th><Th>{t('Estimate')}</Th><Th>{t('State')}</Th><Th /></tr></thead>;
  return (
    <>
      <PageHeader
        screen="requests"
        crumbs={['Shipping']}
        primary={can(viewer.roles, 'request') ? <NewRequestForm sites={siteOptions(w)} incoterms={INCOTERMS.map((i) => ({ value: i.code, label: `${i.code} — ${i.name}` }))} today={today} primary /> : undefined}
      />
      <SectionCard title={t('To triage and drafts')} hint={`${open.length}`}>
        {open.length ? <Table size={12.5}>{head}<tbody>{open.map(row)}</tbody></Table> : <EmptyState>{t('No request waiting.')}</EmptyState>}
      </SectionCard>
      <SectionCard title={t('Handled')} hint={`${done.length}`}>
        {done.length ? <Table size={12.5}>{head}<tbody>{done.map(row)}</tbody></Table> : <EmptyState>{t('Nothing yet.')}</EmptyState>}
      </SectionCard>
    </>
  );
}
