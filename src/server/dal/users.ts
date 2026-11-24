import 'server-only';
// Users of Vector: one row per person who signed in (for the audit trail and the "requested by"); their rights are never stored
// here, they are read in Clavis on every request.
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { writeAudit } from '@/server/db/helpers';
import { users } from '@/server/db/schema';

export interface UserRow {
  id: string;
  oid: string | null;
  email: string;
  name: string;
  active: boolean;
}

export async function userById(id: string): Promise<UserRow | null> {
  const db = await getDb();
  const [u] = await db.select({ id: users.id, oid: users.oid, email: users.email, name: users.name, active: users.active }).from(users).where(eq(users.id, id));
  return u ?? null;
}

export async function userByEmail(email: string): Promise<UserRow | null> {
  const db = await getDb();
  const [u] = await db.select({ id: users.id, oid: users.oid, email: users.email, name: users.name, active: users.active }).from(users).where(eq(users.email, email));
  return u ?? null;
}

/** Finds or creates the user of a Clavis sign-in (by oid, then e-mail), records the sign-in. */
export async function signInUser(input: { oid: string; email: string; name: string | null }): Promise<UserRow> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    let [u] = await tx.select().from(users).where(eq(users.oid, input.oid));
    if (!u) [u] = await tx.select().from(users).where(eq(users.email, input.email));
    if (!u) [u] = await tx.insert(users).values({ oid: input.oid, email: input.email, name: input.name?.trim() || input.email, lastSignInAt: now }).returning();
    else [u] = await tx.update(users).set({ oid: input.oid, name: input.name?.trim() || u.name, lastSignInAt: now }).where(eq(users.id, u.id)).returning();
    await writeAudit(tx, { actorName: u.name, actorUserId: u.id, objectRef: `User ${u.email}`, change: 'Signed in through Clavis', area: 'Sign-in', entityType: 'user', entityId: u.id });
    return { id: u.id, oid: u.oid, email: u.email, name: u.name, active: u.active };
  });
}

export async function recordSignOut(userId: string): Promise<void> {
  const db = await getDb();
  const u = await userById(userId);
  if (!u) return;
  await db.transaction((tx) => writeAudit(tx, { actorName: u.name, actorUserId: u.id, objectRef: `User ${u.email}`, change: 'Signed out', area: 'Sign-in', entityType: 'user', entityId: u.id }));
}
