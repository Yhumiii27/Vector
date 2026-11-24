// Requests for quotation (docs/spec/02 § 2): every RFQ open or recent, its quotes ranked by cost converted to euros and by
// transit time (value = cost + delay penalty per day, ?delay=), the award from here or from the shipment sheet.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Button } from '@norma/charte/ds/Button';
import { Field, Input } from '@norma/charte/ds/Field';
import { Tag } from '@norma/charte/ds/Tag';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { rankQuotes } from '@/domain/quotes';
import { can, canSeeValues } from '@/domain/rights';
import { RFQ_STATE_LABEL, type RfqState } from '@/domain/vocab';
import { AwardForm, QuoteForm } from '@/features/shipping/forms';
import { QuoteTag } from '@/features/shipping/tags';
import { routeOf } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { fmtDate, fmtMoney } from '@/lib/format';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function RfqPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(viewer, today);
  const delay = Math.max(0, Math.min(100_000, Number(sp.delay ?? 0) || 0));
  const values = canSeeValues(viewer.roles);
  const canQuote = can(viewer.roles, 'quote');
  const all = w.shipments.flatMap((v) => v.rfqs.map((r) => ({ v, r }))).sort((a, b) => (a.r.state === 'sent' ? 0 : 1) - (b.r.state === 'sent' ? 0 : 1) || b.r.ref.localeCompare(a.r.ref));
  return (
    <>
      <PageHeader screen="rfq" crumbs={['Shipping']} />
      <SectionCard>
        <form method="get" className={s.toolbar}>
          <Field label={t('Cost of one day of delay (EUR)')}><Input name="delay" size="sm" inputMode="numeric" defaultValue={delay || ''} /></Field>
          <Button type="submit" size="sm" variant="secondary">{t('Rank')}</Button>
          <span className={s.muted}>{t('Value = quote in euros + days slower than the fastest × cost of one day.')}</span>
        </form>
      </SectionCard>
      {all.length ? all.map(({ v, r }) => {
        const ranked = rankQuotes(r.quotes.map((q) => ({ id: q.id, partnerName: q.partnerName, amount: q.amount, currency: q.currency, transitDays: q.transitDays, validUntil: q.validUntil, state: q.state as never })), w.rates, today, delay);
        return (
          <SectionCard key={r.id} title={<><span className={s.ref}>{r.ref}</span> · <Link href={`/shipments/${v.s.ref}?tab=transport`}>{v.s.ref}</Link> {v.s.title}</>} hint={`${routeOf(v)} · ${t(RFQ_STATE_LABEL[r.state as RfqState])} · ${t('answers by')} ${fmtDate(r.dueOn, lang)}`}
            actions={canQuote && r.state === 'sent' ? <QuoteForm rfqRef={r.ref} partners={r.invited.map((i) => ({ value: i.partnerId, label: i.partnerName }))} /> : undefined}>
            <Table size={12.5}>
              <thead><tr><Th>{t('Rank')}</Th><Th>{t('Partner')}</Th>{values && <Th>{t('Amount')}</Th>}{values && <Th>{t('In euros')}</Th>}{values && delay > 0 && <Th>{t('Value')}</Th>}<Th>{t('Transit')}</Th><Th>{t('Valid until')}</Th><Th>{t('State')}</Th><Th /></tr></thead>
              <tbody>
                {ranked.map((q) => (
                  <tr key={q.id}>
                    <Td numeric>{q.rank}</Td>
                    <Td>{q.partnerName} {q.cheapest && <Tag tone="outline" size="sm">{t('Cheapest')}</Tag>} {q.fastest && <Tag tone="outline" size="sm">{t('Fastest')}</Tag>}</Td>
                    {values && <Td numeric>{fmtMoney(q.amount, q.currency, lang)}</Td>}
                    {values && <Td numeric>{fmtMoney(q.eur, 'EUR', lang)}</Td>}
                    {values && delay > 0 && <Td numeric>{fmtMoney(q.value, 'EUR', lang)}</Td>}
                    <Td numeric>{q.transitDays} {t('d')}</Td>
                    <Td nowrap>{fmtDate(q.validUntil, lang)}{q.expired && q.state === 'received' && <> <Tag tone="accent-2" size="sm">{t('Expired')}</Tag></>}</Td>
                    <Td><QuoteTag state={q.state} t={t} /></Td>
                    <Td>{canQuote && r.state === 'sent' && q.state === 'received' && <AwardForm quoteId={q.id} label={`${t('Award')} · ${q.partnerName}`} />}</Td>
                  </tr>
                ))}
                {r.invited.filter((i) => !i.answeredAt).map((i) => <tr key={i.partnerId}><Td /><Td>{i.partnerName}</Td>{values && <Td />}{values && <Td />}{values && delay > 0 && <Td />}<Td /><Td /><Td><Tag tone="neutral">{t('No answer yet')}</Tag></Td><Td /></tr>)}
              </tbody>
            </Table>
          </SectionCard>
        );
      }) : <EmptyState>{t('No request for quotation yet.')}</EmptyState>}
    </>
  );
}
