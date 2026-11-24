// Sidebar model (pure): the entries a viewer sees, by section, with the active one. Screens of one object (a `[code]` in their
// path) are reached from their list, not listed.
import type { RoleKey } from '@/config/roles';
import { SCREENS, SECTION_LABEL, canSee, matchScreen, screenHref, type ScreenId, type Section } from '@/config/screens';

export interface NavEntry {
  id: ScreenId;
  label: string;
  href: string;
  active: boolean;
  /** Count shown next to the entry (open requests, shipments at risk…). */
  count?: number;
}

export interface NavSection {
  key: Exclude<Section, 'fixed'>;
  label: string;
  entries: NavEntry[];
  active: boolean;
}

export function buildNav(roles: readonly RoleKey[], pathname: string, counts: Partial<Record<ScreenId, number>> = {}): { fixed: NavEntry[]; sections: NavSection[] } {
  const current = matchScreen(pathname)?.id ?? null;
  const active = current === 'shipment' ? 'shipments' : current === 'partner' ? 'partners' : current;
  const entry = (id: ScreenId, label: string): NavEntry => ({ id, label, href: screenHref(id), active: id === active, count: counts[id] });
  const visible = SCREENS.filter((s) => canSee(roles, s.id) && !s.path.includes('[code]'));
  const fixed = visible.filter((s) => s.section === 'fixed').map((s) => entry(s.id, s.title));
  const sections: NavSection[] = [];
  for (const key of ['steering', 'shipping', 'network', 'analysis', 'admin'] as const) {
    const entries = visible.filter((s) => s.section === key).map((s) => entry(s.id, s.title));
    if (entries.length) sections.push({ key, label: SECTION_LABEL[key], entries, active: entries.some((e) => e.active) });
  }
  return { fixed, sections };
}
