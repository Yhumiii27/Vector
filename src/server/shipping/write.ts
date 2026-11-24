import 'server-only';
// Shared pieces of the writing Server Functions: the viewer and its right, the yearly references, the shipment re-read through
// the visibility rule inside the transaction, the "touch" that moves `updated_at` (read by vector.pub_expeditions as maj_le),
// and the result type. Every Server Function validates its input (zod) and the right server-side, then writes in ONE
// transaction with its audit row.
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { can, FORBIDDEN, type Right } from '@/domain/rights';
import { getDb } from '@/server/db/client';
import { writeAudit, type AuditInput } from '@/server/db/helpers';
import { counters, shipmentAllocations, shipmentRequests, shipments } from '@/server/db/schema';
import type { Tx } from '@/server/db/types';
import { businessToday } from '@/server/clock';
import { getViewer, type Viewer } from '@/server/session';

export type ActionResult = { ok: true } | { ok: false; error: string };

export class Refusal extends Error {}

export const ok = (): ActionResult => ({ ok: true });
export const refuse = (error: string): ActionResult => ({ ok: false, error });

/** The viewer when one of their roles carries the right, else a refusal. */
export async function viewerWith(right: Right): Promise<Viewer> {
  const v = await getViewer();
  if (!can(v.roles, right)) throw new Refusal(FORBIDDEN);
  return v;
}

/** Runs a Server Function body: refusals and validation errors become a result; anything else is logged and generic. */
export async function run(body: () => Promise<void>, paths: string[] = ['/']): Promise<ActionResult> {
  try {
    await body();
  } catch (e) {
    if (e instanceof Refusal) return refuse(e.message);
    if (e instanceof z.ZodError) return refuse(e.issues[0]?.message ?? 'Invalid input');
    const code = (e as { cause?: { code?: string }; code?: string })?.cause?.code ?? (e as { code?: string })?.code;
    if (code === '23514') return refuse('The database refused a value that breaks a rule');
    if (code === '23505') return refuse('This already exists');
    console.error('[action]', e);
    return refuse('The change could not be saved');
  }
  for (const p of paths) revalidatePath(p, p === '/' ? 'layout' : 'page');
  return ok();
}

/** Next yearly reference "SH-2026-0112" (counter row locked by the write lock of the transaction). */
export async function nextRef(tx: Tx, prefix: 'SR' | 'SH' | 'RFQ' | 'INC', today: string): Promise<string> {
  const year = +today.slice(0, 4);
  const [row] = await tx
    .insert(counters).values({ prefix, year, value: 1 })
    .onConflictDoUpdate({ target: [counters.prefix, counters.year], set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return `${prefix}-${year}-${String(row.value).padStart(4, '0')}`;
}

/** The shipment of a reference as the viewer may see it (a requester: only when it carries one of their requests). */
export async function shipmentFor(tx: Tx, viewer: Viewer, ref: string) {
  const [s] = await tx.select().from(shipments).where(eq(shipments.ref, ref));
  if (!s) throw new Refusal('Shipment not found');
  if (!can(viewer.roles, 'see_all')) {
    const [mine] = await tx.select({ id: shipmentRequests.id }).from(shipmentAllocations)
      .innerJoin(shipmentRequests, eq(shipmentRequests.id, shipmentAllocations.requestId))
      .where(and(eq(shipmentAllocations.shipmentId, s.id), eq(shipmentRequests.requestedById, viewer.userId)));
    if (!mine) throw new Refusal('Shipment not found');
  }
  return s;
}

/** Moves updated_at of the shipment (maj_le of the publications). */
export const touch = (tx: Tx, id: string) => tx.update(shipments).set({ updatedAt: new Date() }).where(eq(shipments.id, id));

/** An audit row of the viewer. */
export const audit = (tx: Tx, v: Viewer, e: Omit<AuditInput, 'actorName' | 'actorUserId' | 'actorRole'>) =>
  writeAudit(tx, { ...e, actorName: v.name, actorUserId: v.userId, actorRole: v.role });

export async function tx<T>(body: (tx: Tx, today: string) => Promise<T>): Promise<T> {
  const db = await getDb();
  const today = await businessToday();
  return db.transaction((t) => body(t, today));
}

// ── Form parsing ─────────────────────────────────────────────────────────────────────────────────────────────────────

const blank = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
export const str = (fd: FormData, k: string) => blank(fd.get(k));
export const opt = (fd: FormData, k: string) => blank(fd.get(k)) || null;
export const num = (fd: FormData, k: string) => {
  const s = blank(fd.get(k)).replace(',', '.');
  return s ? Number(s) : null;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A date is expected');
export const reasonOf = (fd: FormData) => {
  const r = str(fd, 'reason');
  if (r.length < 3) throw new Refusal('A reason is required');
  return r.slice(0, 500);
};
