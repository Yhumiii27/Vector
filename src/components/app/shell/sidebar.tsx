'use client';
// Sidebar, rendered with Norma 2.0's common shell (norma/charte/COQUE.md § 2): brand, ⌘K page search right under it, fixed
// entries, then the sections by theme — collapsible (cookie vector-nav), with counts. At the bottom the "View as" switcher
// (demo mode) or the account menu (Entra mode: roles held, sign out). Neither the language nor the display is here: the
// pair is the last element of every page header and of the top bar.
import { CaretUpDown, Eye, SignOut } from '@phosphor-icons/react/dist/ssr';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { cx } from '@norma/charte/ds/cx';
import { NavEntry, NavList, NavSection, NavSections, PageSearch, Sidebar as CoqueSidebar, type PageHit } from '@norma/charte/ds/Sidebar';
import { ROLE_LABEL, type RoleKey } from '@/config/roles';
import { BRAND_ICON, SCREEN_ICONS } from '@/config/screen-icons';
import type { ScreenId } from '@/config/screens';
import { AUTH_PATHS } from '@/domain/auth';
import { useI18n } from '@/i18n/client';
import { setViewAs } from '@/server/actions/preferences';
import { buildNav, type NavEntry as NavEntryModel } from './nav-model';
import styles from './sidebar.module.css';

export interface SidebarPersona {
  role: RoleKey;
  name: string;
  initials: string;
}

export interface SidebarAccount {
  name: string;
  initials: string;
  roles: RoleKey[];
}

export interface SidebarProps {
  role: RoleKey;
  roles: RoleKey[];
  personas: SidebarPersona[];
  account: SidebarAccount | null;
  counts: Partial<Record<ScreenId, number>>;
  folded: string[];
}

const YEAR = 60 * 60 * 24 * 365;
const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
};

function useDismiss(open: boolean, setOpen: (v: boolean) => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);
  return ref;
}

export function Sidebar({ role, roles, personas, account, counts, folded: initialFolded }: SidebarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const nav = buildNav(roles, pathname, counts);
  const [folded, setFolded] = useState<string[]>(initialFolded);

  const toggle = (key: string) => {
    const next = folded.includes(key) ? folded.filter((k) => k !== key) : [...folded, key];
    setFolded(next);
    setCookie('vector-nav', next.join(','));
  };

  // Every page the viewer may open, for the ⌘K page search (labels translated).
  const pages = useMemo<PageHit[]>(
    () =>
      [...nav.fixed.map((e) => ({ e, section: undefined as string | undefined })), ...nav.sections.flatMap((s) => s.entries.map((e) => ({ e, section: s.label })))].map(({ e, section }) => ({
        href: e.href,
        label: t(e.label),
        section: section ? t(section) : undefined,
        icon: SCREEN_ICONS[e.id] ?? Eye,
        badge: e.count || undefined,
      })),
    [nav, t],
  );

  const entry = (n: NavEntryModel, item: boolean) => <NavEntry key={n.id} href={n.href} label={t(n.label)} icon={SCREEN_ICONS[n.id] ?? Eye} active={n.active} badge={n.count || undefined} item={item} />;

  return (
    <CoqueSidebar name="Vector" icon={BRAND_ICON} footer={account ? <AccountMenu account={account} /> : <ViewAs role={role} personas={personas} />}>
      <PageSearch pages={pages}>
        <NavList>{nav.fixed.map((n) => entry(n, false))}</NavList>
        <NavSections>
          {nav.sections.map((sec) => {
            const open = !folded.includes(sec.key) || sec.active;
            return (
              <NavSection key={sec.key} label={t(sec.label)} open={open} onToggle={() => toggle(sec.key)} bright={sec.active} count={open ? undefined : sec.entries.length}>
                {sec.entries.map((n) => entry(n, true))}
              </NavSection>
            );
          })}
        </NavSections>
      </PageSearch>
    </CoqueSidebar>
  );
}

function ViewAs({ role, personas }: { role: RoleKey; personas: SidebarPersona[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useDismiss(open, setOpen);
  const viewer = personas.find((p) => p.role === role) ?? personas[0];
  if (!viewer) return null;
  return (
    <div ref={ref}>
      {open && (
        <div className={cx('elev-md', styles.menu)} role="menu">
          <div className={styles.menuHead}>{t('View as')}</div>
          {personas.map((p) => (
            <button
              key={p.role}
              type="button"
              role="menuitemradio"
              aria-checked={p.role === role}
              className={cx(styles.persona, p.role === role && styles.personaOn)}
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  await setViewAs(p.role);
                });
              }}
            >
              <span className={styles.avatarSm}>{p.initials}</span>
              <span className="coque-who">
                <span className={styles.whoName}>{p.name}</span>
                <span className="coque-who-role">{t(ROLE_LABEL[p.role])}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className="coque-user" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <div className="coque-avatar">{viewer.initials}</div>
        <div className="coque-who">
          <span className="coque-who-name">{viewer.name}</span>
          <span className="coque-who-role">{t(ROLE_LABEL[viewer.role])}</span>
        </div>
        <CaretUpDown className="coque-user-caret" aria-hidden />
      </button>
    </div>
  );
}

function AccountMenu({ account }: { account: SidebarAccount }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref}>
      {open && (
        <div className={cx('elev-md', styles.menu)} role="menu">
          <div className={styles.menuHead}>{t('Roles granted in Clavis')}</div>
          {account.roles.map((r) => (
            <div key={r} className={styles.persona}>
              <span className={styles.whoName}>{t(ROLE_LABEL[r])}</span>
            </div>
          ))}
          <div className={styles.menuSep} />
          <form method="post" action={AUTH_PATHS.signOut} className={styles.signOutForm}>
            <button type="submit" className={styles.persona}>
              <SignOut size={14} aria-hidden />
              <span className={styles.whoName}>{t('Sign out')}</span>
            </button>
          </form>
        </div>
      )}
      <button type="button" className="coque-user" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <div className="coque-avatar">{account.initials}</div>
        <div className="coque-who">
          <span className="coque-who-name">{account.name}</span>
          <span className="coque-who-role">{t(ROLE_LABEL[account.roles[0]])}</span>
        </div>
        <CaretUpDown className="coque-user-caret" aria-hidden />
      </button>
    </div>
  );
}
