// Dark / light display (Norma 1.0): the cookie epc2i-theme gives the theme (dark by default), and the sidebar renders the
// display toggle right next to the language toggle.
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, THEME_COOKIE, themeCookie, themeOf } from '@norma/charte/ds/theme';
import { I18nProvider } from '@/i18n/client';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/server/actions/preferences', () => ({ setLang: vi.fn(), setViewAs: vi.fn(), switchRole: vi.fn() }));

describe('display theme', () => {
  it('reads the shared cookie: light only when it says so, dark otherwise', () => {
    expect(THEME_COOKIE).toBe('epc2i-theme');
    expect(DEFAULT_THEME).toBe('dark');
    expect(themeOf('light')).toBe('light');
    expect(themeOf('dark')).toBe('dark');
    expect(themeOf(undefined)).toBe('dark');
    expect(themeOf('LIGHT')).toBe('dark');
    expect(themeOf('')).toBe('dark');
  });

  it('writes a one-year cookie for the whole site', () => {
    expect(themeCookie('light')).toBe('epc2i-theme=light; path=/; max-age=31536000; samesite=lax');
  });
});

describe('display toggle of the page header', () => {
  async function render(lang: 'fr' | 'en', theme: 'dark' | 'light') {
    const { ThemeToggle } = await import('@norma/charte/ds/ThemeToggle');
    return renderToStaticMarkup(createElement(I18nProvider as (p: { lang: 'fr' | 'en'; children?: ReactNode }) => ReactNode, { lang }, createElement(ThemeToggle, { theme })));
  }

  it('is translated', async () => {
    const html = await render('fr', 'dark');
    expect(html).toContain('aria-label="Affichage sombre"');
    expect(html).toContain('aria-label="Affichage clair"');
  });

  it('marks the theme read by the server as pressed', async () => {
    const html = await render('en', 'light');
    expect(html).toMatch(/aria-label="Light display" aria-pressed="true"/);
    expect(html).toMatch(/aria-label="Dark display" aria-pressed="false"/);
  });
});
