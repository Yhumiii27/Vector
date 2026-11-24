import 'server-only';
// The signed-in viewer in Entra mode (sign-in through Clavis): the sealed session cookie names the user and the role shown; the
// roles are read in clavis.pub_acces on every request (Norma § 6), so a withdrawn access or a changed role applies at the next
// page. A failed read refuses (fail closed).
import { cookies } from 'next/headers';
import { activeRoleOf } from '@/config/roles';
import { grantedRolesFromClavisAccess } from '@/domain/auth';
import { userById } from '@/server/dal/users';
import { readClavisAccess } from '@/server/integrations/clavis/access';
import { initialsOf, type Viewer } from '@/server/viewer';
import { sessionConfig } from './config';
import { readSession, type SessionData } from './session-cookie';

export async function currentSession(): Promise<SessionData | null> {
  const cfg = sessionConfig();
  return readSession(cfg, (await cookies()).get(cfg.cookieName)?.value);
}

export async function entraViewer(): Promise<Viewer | null> {
  const s = await currentSession();
  if (!s) return null;
  let roles;
  try {
    roles = grantedRolesFromClavisAccess(await readClavisAccess(s.oid));
  } catch (e) {
    console.error('[auth] clavis.pub_acces not read:', e instanceof Error ? e.message : e);
    return null;
  }
  const u = await userById(s.uid);
  if (!u || !u.active || u.oid !== s.oid) return null;
  const role = activeRoleOf(roles, s.role);
  return role ? { userId: u.id, name: u.name, email: u.email, initials: initialsOf(u.name), role, roles, demo: false } : null;
}
