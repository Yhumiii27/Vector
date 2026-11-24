// Dark / light display (Norma 1.0) and the common shell (Norma 2.0, norma/charte/COQUE.md § 4): the cookie epc2i-theme gives
// the theme the server puts on <html data-theme>, dark by default; the language / display pair (PrefsStack: FR | EN over
// dark | light) is the last element of every page header and of the top bar, nowhere else.
import fs from 'node:fs';
import path from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME, THEME_COOKIE, themeCookie, themeOf } from '@norma/charte/ds/theme';
import { I18nProvider } from '@/i18n/client';

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

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

describe('language / display pair', () => {
  async function render(lang: 'fr' | 'en', theme: 'dark' | 'light') {
    const { PrefsStack } = await import('@norma/charte/ds/HeaderTools');
    const pair = createElement(PrefsStack, { lang, theme, onSelect: () => undefined });
    return renderToStaticMarkup(createElement(I18nProvider as (p: { lang: 'fr' | 'en'; children?: ReactNode }) => ReactNode, { lang }, pair));
  }

  it('stacks the language over the display, translated', async () => {
    const html = await render('fr', 'dark');
    expect(html.indexOf('aria-label="Langue"')).toBeGreaterThan(-1);
    expect(html.indexOf('aria-label="Affichage"')).toBeGreaterThan(html.indexOf('aria-label="Langue"'));
    expect(html).toContain('aria-label="Affichage sombre"');
    expect(html).toContain('aria-label="Affichage clair"');
  });

  it('marks the language and the theme read by the server as pressed', async () => {
    const html = await render('en', 'light');
    expect(html).toMatch(/aria-pressed="true"[^>]*lang="en"/);
    expect(html).toMatch(/aria-pressed="true" aria-label="Light display"/);
  });

  it('is saved by setLang, in the page header and the top bar, never in the sidebar', () => {
    const prefs = fs.readFileSync(path.join(__dirname, 'prefs.tsx'), 'utf8');
    expect(prefs).toMatch(/<PrefsStack lang=\{lang\} theme=\{theme\} onSelect=\{setLang\} \/>/);
    const header = fs.readFileSync(path.join(__dirname, 'page-header.tsx'), 'utf8');
    expect(header).toContain("from '@norma/charte/ds/PageHeader'");
    expect(header).toMatch(/prefs=\{<VectorPrefs lang=\{lang\} theme=\{theme\} \/>\}/);
    const layout = fs.readFileSync(path.join(process.cwd(), 'src/app/(app)/layout.tsx'), 'utf8');
    expect(layout).toMatch(/<VectorTopBar prefs=\{<VectorPrefs lang=\{lang\} theme=\{theme\} \/>\}/);
    const sidebar = fs.readFileSync(path.join(__dirname, 'sidebar.tsx'), 'utf8');
    expect(sidebar).not.toMatch(/PrefsStack|VectorPrefs|ThemeToggle|ThemeSwitch|LangSwitch|setLang/);
  });

  it('the root layout imports touch.css then coque.css after nocturne.css and puts the theme on <html>', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
    expect(src).toMatch(/<html [^>]*data-theme=\{theme\}/);
    const at = (f: string) => src.indexOf(`import '@norma/charte/${f}'`);
    expect(at('nocturne.css')).toBeGreaterThan(-1);
    expect(at('touch.css')).toBeGreaterThan(at('nocturne.css'));
    expect(at('coque.css')).toBeGreaterThan(at('touch.css'));
  });
});
