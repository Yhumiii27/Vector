'use server';
// Preferences: "View as" (demo mode) and language, validated server-side. Rights are the union of the roles held (no role
// switch: Clavis grants the roles, cumulative).
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isRoleKey } from '@/config/roles';
import { VIEW_AS_REFUSED } from '@/domain/auth';
import { authMode } from '@/server/auth/config';
import { COOKIE } from '@/server/session';

const YEAR = 60 * 60 * 24 * 365;

export async function setViewAs(role: string): Promise<{ ok: boolean; error?: string }> {
  if (authMode() !== 'demo') return { ok: false, error: VIEW_AS_REFUSED };
  if (!isRoleKey(role)) return { ok: false, error: 'Unknown role' };
  (await cookies()).set(COOKIE.role, role, { path: '/', maxAge: YEAR, sameSite: 'lax', httpOnly: true });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setLang(lang: string): Promise<void> {
  if (lang !== 'fr' && lang !== 'en') return;
  (await cookies()).set(COOKIE.lang, lang, { path: '/', maxAge: YEAR, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}
