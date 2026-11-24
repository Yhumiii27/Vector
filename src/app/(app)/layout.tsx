// App shell: Norma 2.0's common shell (norma/charte/COQUE.md): 232 px sidebar | main, and up to 1024 px a top bar (menu
// button, tool name, language / display pair) opening the sidebar as a drawer. Demo mode: "View as" at the bottom of the
// sidebar; Entra mode (sign-in through Clavis): the account menu with the roles Clavis grants. The sidebar counts are
// computed on each request.
import { cookies } from 'next/headers';
import { ClockProvider } from '@/components/app/clock';
import { Sidebar } from '@/components/app/shell/sidebar';
import { VectorPrefs } from '@/components/app/shell/prefs';
import { VectorTopBar } from '@/components/app/shell/topbar';
import { AppShell } from '@norma/charte/ds/AppShell';
import { ToastProvider } from '@norma/charte/ds/Toast';
import { isOpenState } from '@/domain/shipment-state';
import type { ShipmentState } from '@/domain/vocab';
import { authMode } from '@/server/auth/config';
import { businessToday } from '@/server/clock';
import { loadWorld } from '@/server/dal/world';
import { DEMO_PERSONAS, getI18n, getTheme, getViewer } from '@/server/session';
import { initialsOf } from '@/server/viewer';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const [viewer, today, { lang }, theme] = await Promise.all([getViewer(), businessToday(), getI18n(), getTheme()]);
  const world = await loadWorld(viewer, today);
  const entra = authMode() === 'entra';
  const personas = entra ? [] : DEMO_PERSONAS.map((p) => ({ role: p.role, name: p.name, initials: initialsOf(p.name) }));
  const folded = ((await cookies()).get('vector-nav')?.value ?? '').split(',').filter(Boolean);
  const counts = {
    requests: world.requests.filter((r) => r.state === 'submitted').length,
    shipments: world.shipments.filter((v) => isOpenState(v.s.state as ShipmentState)).length,
    incidents: world.shipments.reduce((n, v) => n + v.openIncidents, 0),
    rfq: world.shipments.reduce((n, v) => n + v.rfqs.filter((r) => r.state === 'sent').length, 0),
  };
  return (
    <ClockProvider today={today}>
      <ToastProvider>
        <AppShell
          topbar={<VectorTopBar prefs={<VectorPrefs lang={lang} theme={theme} />} />}
          sidebar={
            <Sidebar
              role={viewer.role}
              roles={viewer.roles}
              personas={personas}
              account={entra ? { name: viewer.name, initials: viewer.initials, roles: viewer.roles } : null}
              counts={counts}
              folded={folded}
            />
          }
        >
          {children}
        </AppShell>
      </ToastProvider>
    </ClockProvider>
  );
}
