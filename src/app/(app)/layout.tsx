// App shell: 232px sidebar | main (Keystone's Nocturne shell). Demo mode: "View as" at the bottom of the sidebar; local mode:
// the signed-in user's account menu instead.
import { ClockProvider } from '@/components/app/clock';
import { Sidebar } from '@/components/app/shell/sidebar';
import styles from '@/components/app/shell/shell.module.css';
import { ToastProvider } from '@norma/charte/ds/Toast';
import { authMode } from '@/server/auth/config';
import { businessToday } from '@/server/clock';
import { initialsOf } from '@/server/viewer';
import { DEMO_PERSONAS, getTheme, getViewer } from '@/server/session';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const [viewer, today, theme] = await Promise.all([getViewer(), businessToday(), getTheme()]);
  const local = authMode() === 'local';
  const personas = local ? [] : DEMO_PERSONAS.map((p) => ({ role: p.role, name: p.name, initials: initialsOf(p.name) }));
  return (
    <ClockProvider today={today}>
      <ToastProvider>
        <div className={styles.root}>
          <Sidebar
            role={viewer.role}
            theme={theme}
            personas={personas}
            account={local ? { name: viewer.name, initials: viewer.initials, role: viewer.role, roles: viewer.roles } : null}
          />
          <main className={styles.main}>{children}</main>
        </div>
      </ToastProvider>
    </ClockProvider>
  );
}
