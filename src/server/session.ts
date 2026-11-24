import 'server-only';
// The viewer and their preferences. Demo mode (VECTOR_AUTH=demo, the default): the "View as" role of the `vector-role` cookie —
// the demonstration persona who holds it —, the shipping manager when none. Entra mode: the user signed in through Clavis, the
// roles read in clavis.pub_acces on every request; without them the request goes to the sign-in page.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { isRoleKey, type RoleKey } from '@/config/roles';
import { AUTH_PATHS } from '@/domain/auth';
import { THEME_COOKIE, themeOf, type Theme } from '@norma/charte/ds/theme';
import { DEFAULT_LANG, makeT, type Lang, type T } from '@/i18n/translate';
import { authMode } from '@/server/auth/config';
import { userByEmail } from '@/server/dal/users';
import { DEMO_PERSONAS } from '@/server/db/seed/personas';
import { initialsOf, type Viewer } from '@/server/viewer';

export type { Viewer } from '@/server/viewer';
export { DEMO_PERSONAS } from '@/server/db/seed/personas';

export const COOKIE = { role: 'vector-role', lang: 'vector-lang' } as const;

export const DEFAULT_DEMO_ROLE: RoleKey = 'manager';

export const getViewer = cache(async (): Promise<Viewer> => {
  if (authMode() === 'entra') {
    const { entraViewer } = await import('@/server/auth/viewer');
    const v = await entraViewer();
    if (!v) redirect(`${AUTH_PATHS.page}?error=session`);
    return v;
  }
  const c = (await cookies()).get(COOKIE.role)?.value;
  const role = isRoleKey(c) ? c : DEFAULT_DEMO_ROLE;
  const persona = DEMO_PERSONAS.find((p) => p.role === role)!;
  const u = await userByEmail(persona.email);
  if (!u) throw new Error(`Demo mode: the database has no demonstration persona for the role "${role}" (VECTOR_SEED=demo)`);
  return { userId: u.id, name: u.name, email: u.email, initials: initialsOf(u.name), role, roles: [role], demo: true };
});

export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(COOKIE.lang)?.value;
  return v === 'en' || v === 'fr' ? v : DEFAULT_LANG;
});

export const getTheme = cache(async (): Promise<Theme> => themeOf((await cookies()).get(THEME_COOKIE)?.value));

export const getI18n = cache(async (): Promise<{ lang: Lang; t: T }> => {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
});
