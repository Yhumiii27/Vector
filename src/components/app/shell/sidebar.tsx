'use client';
// Sidebar (Arche's shell, itself from Keystone): brand, page search (⌘K), fixed entries, then the sections by theme —
// collapsible, with counts. At the bottom the "View as" switcher (demo mode) or the account menu (Entra mode: roles held, sign
// out). The language and display toggles are in the page header (Norma § 7).
import { CaretDown, CaretRight, CaretUpDown, Eye, MagnifyingGlass, SignOut } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { cx } from '@norma/charte/ds/cx';
import { ROLE_LABEL, type RoleKey } from '@/config/roles';
import { BRAND_ICON, SCREEN_ICONS } from '@/config/screen-icons';
import type { ScreenId } from '@/config/screens';
import { AUTH_PATHS } from '@/domain/auth';
import { useI18n } from '@/i18n/client';
import { setViewAs } from '@/server/actions/preferences';
import { buildNav, type NavEntry } from './nav-model';
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
  const router = useRouter();
  const nav = buildNav(roles, pathname, counts);
  const [folded, setFolded] = useState<string[]>(initialFolded);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const Brand = BRAND_ICON;

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = (key: string) => {
    const next = folded.includes(key) ? folded.filter((k) => k !== key) : [...folded, key];
    setFolded(next);
    setCookie('vector-nav', next.join(','));
  };

  const all = useMemo(() => [...nav.fixed.map((e) => ({ ...e, section: '' })), ...nav.sections.flatMap((s) => s.entries.map((e) => ({ ...e, section: s.label })))], [nav]);
  const query = q.trim().toLowerCase();
  const hits = query ? all.filter((e) => t(e.label).toLowerCase().includes(query) || e.label.toLowerCase().includes(query)).slice(0, 12) : [];
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setQ('');
    else if (e.key === 'Enter' && hits[0]) {
      router.push(hits[0].href);
      setQ('');
    }
  };

  const entry = (n: NavEntry, item: boolean) => {
    const Icon = SCREEN_ICONS[n.id] ?? Eye;
    return (
      <Link key={n.id} href={n.href} className={cx(styles.entry, item && styles.item, n.active && styles.active)} aria-current={n.active ? 'page' : undefined}>
        <Icon size={16} className={styles.icon} />
        <span className={styles.label}>{t(n.label)}</span>
        {n.count ? <span className={styles.badge}>{n.count}</span> : null}
      </Link>
    );
  };

  return (
    <aside className={styles.aside} aria-label={t('Main menu')}>
      <div className={styles.brand}>
        <div className={styles.logo}>
          <Brand size={15} />
        </div>
        <div className={styles.wordmark}>Vector</div>
      </div>
      <div className={styles.search}>
        <MagnifyingGlass size={13} className={styles.searchIcon} />
        <input
          ref={searchRef}
          className={cx('input', styles.searchInput)}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder={t('Go to a page…')}
          aria-label={t('Go to a page…')}
        />
        <span className={styles.kbd}>⌘K</span>
      </div>
      {query ? (
        <div className={styles.list}>
          {hits.map((n) => {
            const Icon = SCREEN_ICONS[n.id] ?? Eye;
            return (
              <Link key={n.id} href={n.href} onClick={() => setQ('')} className={cx(styles.entry, styles.hit, n.active && styles.active)}>
                <Icon size={16} className={styles.icon} />
                <span className={styles.hitText}>
                  <span className={styles.hitLabel}>{t(n.label)}</span>
                  <span className={styles.hitSection}>{n.section ? t(n.section) : ''}</span>
                </span>
              </Link>
            );
          })}
          {!hits.length && <span className={styles.empty}>{t('No page matches')}</span>}
        </div>
      ) : (
        <>
          <div className={styles.list}>{nav.fixed.map((n) => entry(n, false))}</div>
          <div className={styles.sections}>
            {nav.sections.map((sec) => {
              const open = !folded.includes(sec.key) || sec.active;
              const Chev = open ? CaretDown : CaretRight;
              return (
                <div key={sec.key} className={styles.section}>
                  <button type="button" className={cx(styles.secHead, styles.bright)} onClick={() => toggle(sec.key)} aria-expanded={open}>
                    <Chev size={11} className={styles.icon} />
                    <span className={styles.label}>{t(sec.label)}</span>
                    {!open && <span className={styles.secCount}>{sec.entries.length}</span>}
                  </button>
                  {open && sec.entries.map((n) => entry(n, true))}
                </div>
              );
            })}
          </div>
        </>
      )}
      {account ? <AccountMenu account={account} /> : <ViewAs role={role} personas={personas} />}
    </aside>
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
    <div ref={ref} className={styles.viewAs}>
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
              <span className={styles.who}>
                <span className={styles.whoName}>{p.name}</span>
                <span className={styles.whoRole}>{t(ROLE_LABEL[p.role])}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <div className={styles.avatar}>{viewer.initials}</div>
        <div className={styles.who}>
          <span className={styles.triggerName}>{viewer.name}</span>
          <span className={styles.whoRole}>{t(ROLE_LABEL[viewer.role])}</span>
        </div>
        <CaretUpDown className={styles.caret} />
      </button>
    </div>
  );
}

function AccountMenu({ account }: { account: SidebarAccount }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref} className={styles.viewAs}>
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
              <SignOut size={14} />
              <span className={styles.whoName}>{t('Sign out')}</span>
            </button>
          </form>
        </div>
      )}
      <button type="button" className={styles.trigger} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <div className={styles.avatar}>{account.initials}</div>
        <div className={styles.who}>
          <span className={styles.triggerName}>{account.name}</span>
          <span className={styles.whoRole}>{t(ROLE_LABEL[account.roles[0]])}</span>
        </div>
        <CaretUpDown className={styles.caret} />
      </button>
    </div>
  );
}
