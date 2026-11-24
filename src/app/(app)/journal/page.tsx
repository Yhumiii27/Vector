// The journal (lot A): every change Vector recorded — requests, shipments, transport, customs, costs, partners, sign-in —, append-only, newest
// first, filtered by text, area, period and person (GET form, the filters stay in the URL), 100 entries a page, exported as
// CSV with the same filters (« Export (CSV) » in the header). Read by the shipping manager and the administrator. Typed text (names,
// reasons) is shown as typed; the changes are Vector's EN source text.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DownloadSimple } from '@phosphor-icons/react/dist/ssr';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { Button, ButtonLink } from '@norma/charte/ds/Button';
import { Field, Input, Select } from '@norma/charte/ds/Field';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { can } from '@/domain/rights';
import { JOURNAL_AREAS, JOURNAL_EXPORT_MAX, JOURNAL_PAGE_SIZE, journalQuery, parseJournalFilters } from '@/domain/journal';
import s from '@/features/journal/journal.module.css';
import { journalPage } from '@/server/dal/journal';
import { getI18n, getViewer } from '@/server/session';

type SP = Record<string, string | string[] | undefined>;

export default async function JournalPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ t, lang }, viewer, sp] = await Promise.all([getI18n(), getViewer(), searchParams]);
  if (!can(viewer.roles, 'journal')) notFound();
  const f = parseJournalFilters(sp);
  const { rows, total } = await journalPage(f);
  const pages = Math.max(1, Math.ceil(total / JOURNAL_PAGE_SIZE));
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Paris' });
  const exportHref = `/journal/export${journalQuery({ ...f, page: 1 })}`;
  return (
    <>
      <PageHeader
        screen="journal"
        crumbs={['Administration']}
        primary={<ButtonLink href={exportHref} prefetch={false} icon={DownloadSimple} variant="primary" size="sm">{t('Export (CSV)')}</ButtonLink>}
      />
      <SectionCard title={t('Filters')} gap={10}>
        <form className={s.toolbar} method="get">
          <Field label={t('Search')}>
            <Input name="q" size="sm" defaultValue={f.q ?? ''} placeholder={t('Object, actor, change, reason')} />
          </Field>
          <Field label={t('Area')}>
            <Select name="area" size="sm" defaultValue={f.area ?? ''} options={[{ value: '', label: t('All') }, ...JOURNAL_AREAS.map((a) => ({ value: a, label: t(a) }))]} />
          </Field>
          <Field label={t('From')}>
            <Input name="from" type="date" size="sm" defaultValue={f.from ?? ''} />
          </Field>
          <Field label={t('To')}>
            <Input name="to" type="date" size="sm" defaultValue={f.to ?? ''} />
          </Field>
          {f.personId && <input type="hidden" name="person" value={f.personId} />}
          <Button type="submit" size="sm" variant="secondary">{t('Filter')}</Button>
          {(f.q || f.area || f.from || f.to || f.personId) && <Link href="/journal" className={s.reset}>{t('Clear the filters')}</Link>}
        </form>
        <p className={s.hint}>{t('The journal is append-only: no entry is ever changed or deleted. An export holds at most')} {JOURNAL_EXPORT_MAX.toLocaleString(lang)} {t('entries')}.</p>
      </SectionCard>
      <SectionCard title={t('Entries')} hint={`${total} ${t('entries')}`}>
        {rows.length ? (
          <Table size={12.5}>
            <thead>
              <tr>
                <Th>{t('When')}</Th>
                <Th>{t('Actor')}</Th>
                <Th>{t('Area')}</Th>
                <Th>{t('Object')}</Th>
                <Th>{t('Change')}</Th>
                <Th>{t('Reason')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td tone="secondary" className={s.when}>{fmt.format(r.occurredAt)}</Td>
                  <Td>{r.actorName}</Td>
                  <Td tone="secondary">{t(r.area)}</Td>
                  <Td>{r.objectRef}</Td>
                  <Td>{r.change}</Td>
                  <Td tone="secondary">{r.reason ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className={s.hint}>{t('No entry matches these filters.')}</p>
        )}
        {pages > 1 && (
          <nav className={s.pager} aria-label={t('Pages')}>
            {f.page > 1 && <Link href={`/journal${journalQuery({ ...f, page: f.page - 1 })}`}>{t('Newer')}</Link>}
            <span>{f.page} / {pages}</span>
            {f.page < pages && <Link href={`/journal${journalQuery({ ...f, page: f.page + 1 })}`}>{t('Older')}</Link>}
          </nav>
        )}
      </SectionCard>
    </>
  );
}
