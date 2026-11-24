// Connectors (Norma § 5): what Vector reads and writes in the other tools, how, and its state — simulated, waiting for Matrix's
// link or the owning tool, or live — and the outbox (messages queued for Codex, Vigie and the mail).
import { desc } from 'drizzle-orm';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { EmptyState } from '@/components/app/EmptyState';
import { Tag } from '@norma/charte/ds/Tag';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import s from '@/features/shipping/pages.module.css';
import { fmtInstant } from '@/lib/format';
import { getDb } from '@/server/db/client';
import { outbox } from '@/server/db/schema';
import { CONNECTORS } from '@/server/integrations/connectors';
import { readKeystoneProjects } from '@/server/integrations/keystone/projects';
import { getI18n } from '@/server/session';

const STATE_LABEL = { simulated: 'Simulated', waiting: 'Waiting for the link', live: 'Live' } as const;

export default async function ConnectorsPage() {
  const [{ t, lang }, keystone] = await Promise.all([getI18n(), readKeystoneProjects()]);
  const rows = await (await getDb()).select().from(outbox).orderBy(desc(outbox.createdAt)).limit(100);
  return (
    <>
      <PageHeader screen="connectors" crumbs={['Administration']} />
      <SectionCard title={t('Connectors')} hint={t('Nothing leaves the server until the IT department and the owning tool validate it.')}>
        <Table size={12.5}>
          <thead><tr><Th>{t('Tool')}</Th><Th>{t('Object')}</Th><Th>{t('Nature')}</Th><Th>{t('Use')}</Th><Th>{t('State')}</Th><Th>{t('Request')}</Th></tr></thead>
          <tbody>
            {CONNECTORS.map((c) => (
              <tr key={c.tool + c.object}>
                <Td>{c.tool}</Td><Td><code>{c.object}</code></Td><Td>{t(c.nature === 'read' ? 'Read' : 'Write')}</Td><Td>{t(c.how)}</Td>
                <Td><Tag tone={c.state === 'live' ? 'accent' : c.state === 'simulated' ? 'outline' : 'neutral'}>{t(STATE_LABEL[c.state])}</Tag></Td><Td>{c.request}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className={s.muted}>{t('keystone.pub_projets')}: {keystone.state === 'available' ? `${keystone.rows.length} ${t('projects read')}` : t('source unavailable')}</p>
      </SectionCard>
      <SectionCard title={t('Outbox')}>
        {rows.length ? (
          <Table size={12.5}>
            <thead><tr><Th>{t('Queued')}</Th><Th>{t('Target')}</Th><Th>{t('Kind')}</Th><Th>{t('Content')}</Th><Th>{t('State')}</Th><Th>{t('Result')}</Th></tr></thead>
            <tbody>{rows.map((m) => <tr key={m.id}><Td nowrap>{fmtInstant(m.createdAt, lang)}</Td><Td>{m.target}</Td><Td>{m.kind}</Td><Td tone="secondary"><code>{JSON.stringify(m.payload).slice(0, 120)}</code></Td><Td><Tag tone={m.state === 'pending' ? 'accent-2' : m.state === 'failed' ? 'accent' : 'outline'}>{t(m.state === 'pending' ? 'Pending' : m.state === 'sent' ? 'Sent' : 'Failed')}</Tag></Td><Td>{m.resultRef ?? m.lastError ?? '—'}</Td></tr>)}</tbody>
          </Table>
        ) : <EmptyState>{t('The outbox is empty.')}</EmptyState>}
      </SectionCard>
    </>
  );
}
