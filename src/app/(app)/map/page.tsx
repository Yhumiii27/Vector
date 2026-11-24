// Map of flows (docs/spec/02 § 6): the group's sites, the mines and the shipments in progress drawn on a simplified planisphere
// (inline SVG, equirectangular, no external tile, no network). A dashed route is forecast late; a grey one delivered this month.
import Link from 'next/link';
import { PageHeader } from '@/components/app/shell/page-header';
import { SectionCard } from '@/components/app/SectionCard';
import { Table, Td, Th } from '@norma/charte/ds/Table';
import { CONTINENTS, MAP_H, MAP_W, arc, pathOf, project } from '@/domain/geo';
import { isOpenState } from '@/domain/shipment-state';
import { MODE_LABEL, type Mode, type ShipmentState } from '@/domain/vocab';
import { ShipmentTag } from '@/features/shipping/tags';
import { routeOf } from '@/features/shipping/view-helpers';
import s from '@/features/shipping/pages.module.css';
import { fmtDate } from '@/lib/format';
import { addDaysIso } from '@/lib/dates';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { getI18n, getViewer } from '@/server/session';

export default async function MapPage() {
  const [{ t, lang }, viewer, today] = await Promise.all([getI18n(), getViewer(), businessToday()]);
  const w = await loadWorld(viewer, today);
  const recent = addDaysIso(today, -30);
  const shown = w.shipments.filter((v) => v.from?.latitude != null && v.to?.latitude != null && (isOpenState(v.s.state as ShipmentState) || (v.s.deliveredOn ?? '') >= recent));
  const used = new Set(shown.flatMap((v) => [v.from!.code, v.to!.code]));
  const sites = w.sites.filter((x) => x.latitude != null && (used.has(x.code) || x.kind === 'workshop' || x.kind === 'warehouse'));
  const lines = [];
  for (let lon = -150; lon <= 180; lon += 30) lines.push(`M${project(lon, 85).x},${project(lon, 85).y} L${project(lon, -85).x},${project(lon, -85).y}`);
  for (let lat = -60; lat <= 60; lat += 30) lines.push(`M0,${project(0, lat).y} L${MAP_W},${project(0, lat).y}`);
  return (
    <>
      <PageHeader screen="map" crumbs={['Steering']} />
      <SectionCard title={t('Shipments in progress and delivered in the last 30 days')}>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className={s.map} role="img" aria-label={t('Map of the shipments in progress')}>
          <path d={lines.join(' ')} className={s.graticule} />
          {CONTINENTS.map((c, i) => <path key={i} d={pathOf(c)} className={s.land} />)}
          {shown.map((v) => {
            const a = project(v.from!.longitude!, v.from!.latitude!);
            const b = project(v.to!.longitude!, v.to!.latitude!);
            const done = v.s.state === 'delivered' || v.s.state === 'closed';
            return (
              <Link key={v.s.id} href={`/shipments/${v.s.ref}`}>
                <path d={arc(a, b)} className={`${s.route} ${v.late.atRisk ? s.routeLate : ''} ${done ? s.routeDone : ''}`}>
                  <title>{`${v.s.ref} · ${routeOf(v)} · ${t('ETA')} ${fmtDate(v.late.eta, lang)}`}</title>
                </path>
              </Link>
            );
          })}
          {sites.map((x) => {
            const p = project(x.longitude!, x.latitude!);
            const group = x.kind === 'workshop' || x.kind === 'warehouse';
            return (
              <g key={x.code}>
                <circle cx={p.x} cy={p.y} r={group ? 3.5 : 2.8} className={group ? s.siteGroup : s.site}><title>{x.name}</title></circle>
                {!group && <text x={p.x + 5} y={p.y + 3} className={s.mapLabel}>{x.name}</text>}
              </g>
            );
          })}
        </svg>
        <div className={s.legend}>
          <span><span className={s.swatch} />{t('In progress')}</span>
          <span><span className={`${s.swatch} ${s.swatchLate}`} />{t('Forecast late')}</span>
          <span><span className={`${s.swatch} ${s.swatchDone}`} />{t('Delivered')}</span>
          <span className={s.muted}>{t('Simplified outlines, for orientation only.')}</span>
        </div>
      </SectionCard>
      <SectionCard title={t('Shipments on the map')}>
        <Table size={12.5}>
          <thead><tr><Th>{t('Shipment')}</Th><Th>{t('Route')}</Th><Th>{t('Mode')}</Th><Th>{t('State')}</Th><Th>{t('Current ETA')}</Th></tr></thead>
          <tbody>{shown.map((v) => <tr key={v.s.id}><Td><Link href={`/shipments/${v.s.ref}`}>{v.s.ref}</Link></Td><Td>{routeOf(v)}</Td><Td>{t(MODE_LABEL[v.s.mode as Mode])}</Td><Td><ShipmentTag state={v.s.state} t={t} /></Td><Td nowrap>{fmtDate(v.s.ata ?? v.late.eta, lang)}</Td></tr>)}</tbody>
        </Table>
      </SectionCard>
    </>
  );
}
