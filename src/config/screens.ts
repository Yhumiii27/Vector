// Screen registry (docs/spec/06 § 2): id, route, title (EN source string), sidebar section and the roles that see it. Pure:
// no component, no server import, so server code, the proxy and scripts can load it. Icons are in ./screen-icons.ts.
import type { RoleKey } from './roles';

export type ScreenId =
  | 'home' | 'calendar' | 'map' | 'requests' | 'shipments' | 'shipment' | 'rfq' | 'incidents' | 'partners' | 'partner' | 'customs'
  | 'reports' | 'admin' | 'connectors' | 'journal';

export type Section = 'fixed' | 'steering' | 'shipping' | 'network' | 'analysis' | 'admin';

export interface ScreenDef {
  id: ScreenId;
  path: string;
  title: string;
  section: Section;
  roles: readonly RoleKey[] | 'all';
}

const STAFF: readonly RoleKey[] = ['manager', 'coordinator', 'compliance', 'finance', 'packing', 'reader', 'admin'];

export const SCREENS: readonly ScreenDef[] = [
  { id: 'home', path: '/', title: 'Home', section: 'fixed', roles: 'all' },
  { id: 'calendar', path: '/calendar', title: 'Departures and arrivals', section: 'steering', roles: 'all' },
  { id: 'map', path: '/map', title: 'Map of flows', section: 'steering', roles: 'all' },
  { id: 'requests', path: '/requests', title: 'Shipment requests', section: 'shipping', roles: 'all' },
  { id: 'shipments', path: '/shipments', title: 'Shipments', section: 'shipping', roles: 'all' },
  { id: 'shipment', path: '/shipments/[code]', title: 'Shipment', section: 'shipping', roles: 'all' },
  { id: 'rfq', path: '/rfq', title: 'Requests for quotation', section: 'shipping', roles: ['manager', 'coordinator', 'finance', 'admin', 'reader'] },
  { id: 'incidents', path: '/incidents', title: 'Incidents and claims', section: 'shipping', roles: 'all' },
  { id: 'partners', path: '/partners', title: 'Carriers and forwarders', section: 'network', roles: STAFF },
  { id: 'partner', path: '/partners/[code]', title: 'Partner', section: 'network', roles: STAFF },
  { id: 'customs', path: '/customs', title: 'Customs and compliance', section: 'network', roles: STAFF },
  { id: 'reports', path: '/reports', title: 'Reports and exports', section: 'analysis', roles: ['manager', 'coordinator', 'finance', 'compliance', 'admin', 'reader'] },
  { id: 'admin', path: '/admin', title: 'Reference lists and thresholds', section: 'admin', roles: ['manager', 'admin', 'compliance'] },
  { id: 'connectors', path: '/admin/connectors', title: 'Connectors', section: 'admin', roles: ['manager', 'admin'] },
  { id: 'journal', path: '/journal', title: 'Journal', section: 'admin', roles: ['manager', 'admin'] },
];

export const SCREEN_BY_ID = Object.fromEntries(SCREENS.map((s) => [s.id, s])) as Record<ScreenId, ScreenDef>;

export const SECTION_LABEL: Record<Exclude<Section, 'fixed'>, string> = {
  steering: 'Steering', shipping: 'Shipping', network: 'Partners and customs', analysis: 'Analysis', admin: 'Administration',
};

export function canSee(role: RoleKey | readonly RoleKey[], id: ScreenId): boolean {
  const r = SCREEN_BY_ID[id].roles;
  const held = typeof role === 'string' ? [role] : role;
  return r === 'all' || held.some((x) => r.includes(x));
}

export function screenHref(id: ScreenId, params: { code?: string } = {}): string {
  const p = SCREEN_BY_ID[id].path;
  if (!p.includes('[code]')) return p;
  if (!params.code) throw new Error(`screenHref(${id}) needs a code`);
  return p.replace('[code]', encodeURIComponent(params.code));
}

export function matchScreen(pathname: string): ScreenDef | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const byLength = [...SCREENS].sort((a, b) => b.path.length - a.path.length);
  for (const s of byLength) {
    const re = new RegExp('^' + s.path.replace(/\[code\]/, '[^/]+').replace(/\//g, '\\/') + '(\\/.*)?$');
    if (s.path === '/' ? clean === '/' : re.test(clean)) return s;
  }
  return null;
}
