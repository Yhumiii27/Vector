// Audit trail writer (copied from Keystone's src/server/db/helpers.ts, R-168). It runs inside the
// caller's transaction. `audit_entries` is append-only: a database trigger refuses UPDATE, DELETE and TRUNCATE.
import { auditEntries } from './schema';
import type { DB, Tx } from './types';

type Q = DB | Tx;

export interface AuditInput {
  /** Instant of the change (default now; tests date their rows with it). */
  occurredAt?: Date;
  actorName: string;
  /** The user account that acted; null for systems. */
  actorUserId: string | null;
  actorRole?: string | null;
  /** Business reference of the object ("CPX-APM-2026-01", "User n.diallo@…"). */
  objectRef: string;
  /** EN source text: "status: Draft → Active". */
  change: string;
  area: string;
  entityType?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** The reason the actor gave (forced criterion, refusal…). */
  reason?: string | null;
}

/** Appends one audit row. */
export async function writeAudit(q: Q, e: AuditInput): Promise<void> {
  await q.insert(auditEntries).values({
    occurredAt: e.occurredAt ?? new Date(), actorName: e.actorName, actorUserId: e.actorUserId, actorRole: e.actorRole ?? null,
    objectRef: e.objectRef, change: e.change, area: e.area, entityType: e.entityType ?? null, entityId: e.entityId ?? null,
    before: e.before ?? null, after: e.after ?? null, reason: e.reason?.trim() || null,
  });
}
