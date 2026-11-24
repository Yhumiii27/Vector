// Page header (Arche's, from Keystone): breadcrumb, title, the page's actions (beyond three: the "Actions" list), then the
// FR / EN toggle and, right next to it, the dark / light display toggle (Norma § 7). A screen outside the viewer's roles shows
// "Read-only" and hides its actions.
import { Eye } from '@phosphor-icons/react/dist/ssr';
import type { ReactNode } from 'react';
import { SCREEN_BY_ID, canSee, type ScreenId } from '@/config/screens';
import { ThemeToggle } from '@norma/charte/ds/ThemeToggle';
import { getI18n, getTheme, getViewer } from '@/server/session';
import styles from './header.module.css';
import { HeaderActions } from './header-actions';
import { LangToggle } from './lang-toggle';

export interface PageHeaderProps {
  screen: ScreenId;
  /** Title override, already translated or typed. */
  title?: string;
  crumbs?: string[];
  /** Typed breadcrumb item shown as is (a shipment reference). */
  crumbData?: string;
  /** Typed or translated line under the title. */
  subtitle?: ReactNode;
  primary?: ReactNode;
  /** Other actions the viewer may take (client elements only, so they can be counted). */
  actions?: ReactNode;
}

export async function PageHeader({ screen, title, crumbs = [], crumbData, subtitle, primary, actions }: PageHeaderProps) {
  const [{ t, lang }, viewer, theme] = await Promise.all([getI18n(), getViewer(), getTheme()]);
  const def = SCREEN_BY_ID[screen];
  const outside = !canSee(viewer.roles, screen);
  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <div className={styles.crumb}>
            <span>Vector</span>
            {crumbs.map((c) => (
              <span key={c} style={{ display: 'contents' }}>
                <span className={styles.sep}>/</span>
                <span>{t(c)}</span>
              </span>
            ))}
            {crumbData && (
              <>
                <span className={styles.sep}>/</span>
                <span>{crumbData}</span>
              </>
            )}
          </div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title ?? t(def.title)}</h1>
            {outside && (
              <span className={`tag tag-outline ${styles.roTag}`}>
                <Eye size={12} /> {t('Read-only')}
              </span>
            )}
          </div>
          {subtitle && <div className="text-muted" style={{ fontSize: 'var(--text-sm, 13px)' }}>{subtitle}</div>}
        </div>
        <div className={styles.actions}>
          {!outside && (
            <HeaderActions>
              {primary}
              {actions}
            </HeaderActions>
          )}
          <LangToggle lang={lang} label={t('Language')} />
          <ThemeToggle theme={theme} />
        </div>
      </header>
    </>
  );
}
