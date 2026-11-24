// Departures and arrivals (docs/spec/02 § 5): a month view (?month=YYYY-MM) of departures (ETD / ATD), arrivals (ETA / ATA),
// cut-offs, dates of need and latest shipment dates of the letters of credit.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import { ButtonLink } from '@norma/charte/ds/Button';
import { FilterBar, FilterGroup, FilterNote } from '@norma/charte/ds/FilterBar';
import s from '@/features/shipping/pages.module.css';
import { addDaysIso, dowOfIso } from '@/lib/dates';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

interface Ev { day: string; ref: string; label: string; kind: 'dep' | 'arr' | 'cut' | 'need' }

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ t, lang }, viewer, today, sp] = await Promise.all([getI18n(), getViewer(), businessToday(), searchParams]);
  const w = await loadWorld(viewer, today);
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : today.slice(0, 7);
  const first = `${month}-01`;
  const start = addDaysIso(first, -((dowOfIso(first) + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDaysIso(start, i));
  const evs: Ev[] = [];
  for (const v of w.shipments) {
    if (v.s.state === 'cancelled') continue;
    const dep = v.s.atd ?? v.s.etd;
    if (dep) evs.push({ day: dep, ref: v.s.ref, label: `${v.s.atd ? '✓ ' : ''}${t('Departure')} ${v.s.ref}`, kind: 'dep' });
    const arr = v.s.ata ?? v.late.eta;
    if (arr) evs.push({ day: arr, ref: v.s.ref, label: `${v.s.ata ? '✓ ' : ''}${t('Arrival')} ${v.s.ref}`, kind: 'arr' });
    if (v.booking?.docsCutoff) evs.push({ day: v.booking.docsCutoff.toISOString().slice(0, 10), ref: v.s.ref, label: `${t('Documents cut-off')} ${v.s.ref}`, kind: 'cut' });
    if (v.booking?.cargoCutoff) evs.push({ day: v.booking.cargoCutoff.toISOString().slice(0, 10), ref: v.s.ref, label: `${t('Cargo cut-off')} ${v.s.ref}`, kind: 'cut' });
    if (v.s.lcLatestShipment) evs.push({ day: v.s.lcLatestShipment, ref: v.s.ref, label: `${t('Letter of credit: latest shipment')} ${v.s.ref}`, kind: 'cut' });
    if (v.neededOn && !v.s.deliveredOn) evs.push({ day: v.neededOn, ref: v.s.ref, label: `${t('Needed on site')} ${v.s.ref}`, kind: 'need' });
  }
  const prev = addDaysIso(first, -1).slice(0, 7);
  const next = addDaysIso(`${month}-28`, 7).slice(0, 7);
  const title = new Date(`${first}T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', year: 'numeric' });
  const heads = lang === 'fr' ? ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const cls = { dep: s.evDep, arr: s.evArr, cut: s.evCut, need: s.evNeed };
  return (
    <>
      <PageHeader
        screen="calendar"
        crumbs={['Steering']}
        toolbar={
          <FilterBar>
            <FilterGroup>
              <ButtonLink href={`/calendar?month=${prev}`} size="sm" variant="secondary" icon={CaretLeft}>{t('Previous month')}</ButtonLink>
              <ButtonLink href="/calendar" size="sm" variant="secondary">{t('This month')}</ButtonLink>
              <ButtonLink href={`/calendar?month=${next}`} size="sm" variant="secondary" iconRight={CaretRight}>{t('Next month')}</ButtonLink>
            </FilterGroup>
            <FilterNote>{title}</FilterNote>
          </FilterBar>
        }
      />
      <SectionCard title={title}>
        <div className={s.calendar}>
          {heads.map((h) => <div key={h} className={s.dayHead}>{h}</div>)}
          {days.map((d) => (
            <div key={d} className={`${s.day} ${d.slice(0, 7) !== month ? s.dayOut : ''} ${d === today ? s.dayToday : ''}`}>
              <span className={s.dayNum}>{+d.slice(8)}</span>
              {evs.filter((e) => e.day === d).map((e, i) => <Link key={i} href={`/shipments/${e.ref}`} className={`${s.ev} ${cls[e.kind]}`} title={e.label}>{e.label}</Link>)}
            </div>
          ))}
        </div>
        <div className={s.legend}>
          <span><span className={s.swatch} />{t('Departure')}</span>
          <span><span className={`${s.swatch} ${s.swatchDone}`} />{t('Arrival')}</span>
          <span><span className={`${s.swatch} ${s.swatchLate}`} />{t('Cut-off and letter of credit')}</span>
          <span>✓ {t('actual date')}</span>
        </div>
      </SectionCard>
    </>
  );
}
