// Page header: Norma 2.0's common header (norma/charte/COQUE.md § 3), in its fixed order — breadcrumb (section › … ›
// object, without the tool's name) and the page's <h1> · the page's actions (the main one rightmost, the "Actions" menu
// beyond three buttons) · the language / display pair, always the last element. A screen outside the viewer's roles shows
// "Read-only", hides its actions and shows the "outside my workspace" banner under the header.
import { Eye } from '@phosphor-icons/react/dist/ssr';
import type { ReactNode } from 'react';
import { PageHeader as CoqueHeader } from '@norma/charte/ds/PageHeader';
import { SCREEN_BY_ID, canSee, type ScreenId } from '@/config/screens';
import { getI18n, getTheme, getViewer } from '@/server/session';
import { VectorPrefs } from './prefs';

export interface PageHeaderProps {
  screen: ScreenId;
  /** Title override, already translated or typed. */
  title?: string;
  /** Breadcrumb, EN source strings (translated) — the tool's name is not repeated. */
  crumbs?: string[];
  /** Typed breadcrumb item shown as is (a shipment reference). */
  crumbData?: string;
  /** Typed or translated line under the title. */
  subtitle?: ReactNode;
  /** The page's main action (accent button, the rightmost one). */
  primary?: ReactNode;
  /** Other actions the viewer may take (client elements only, so they can be counted). */
  actions?: ReactNode;
  /** Tabs, views and filters of the page (`<FilterBar>`), right under the header. */
  toolbar?: ReactNode;
}

export async function PageHeader({ screen, title, crumbs = [], crumbData, subtitle, primary, actions, toolbar }: PageHeaderProps) {
  const [{ t, lang }, viewer, theme] = await Promise.all([getI18n(), getViewer(), getTheme()]);
  const def = SCREEN_BY_ID[screen];
  const outside = !canSee(viewer.roles, screen);
  return (
    <CoqueHeader
      crumbs={[...crumbs.map((c) => t(c)), ...(crumbData ? [crumbData] : [])]}
      title={title ?? t(def.title)}
      titleAside={
        outside ? (
          <span className="tag tag-outline">
            <Eye size={12} aria-hidden /> {t('Read-only')}
          </span>
        ) : undefined
      }
      subtitle={subtitle}
      primary={primary}
      actions={actions}
      prefs={<VectorPrefs lang={lang} theme={theme} />}
      outside={outside ? t('Outside my workspace · Read-only') : undefined}
      toolbar={toolbar}
    />
  );
}
