import 'server-only';
// Outbox runner (job `outbox`): sends the pending messages to Codex (deposit of a document), Vigie (dangerous goods notice,
// transport incident) and the mail (RFQs). Every connector is a SIMULATION until the IT department and the owning tool
// validate it (docs/spec/05, requests DC-1, DV-1): nothing leaves the server. A simulated Codex deposit returns a reference
// "SHP-SIM-…" written back on the document (state stays `expected` until a person checks the document in Codex).
import { and, eq } from 'drizzle-orm';
import { outbox, shipmentDocuments } from '@/server/db/schema';
import type { DB } from '@/server/db/types';
import { writeAudit } from '@/server/db/helpers';

export type Sent = { ok: true; ref: string | null } | { ok: false; error: string };

/** Simulated Codex: POST /api/documents would return the document identifier. */
export function simulateCodexDeposit(payload: Record<string, unknown>, n: number): Sent {
  if (typeof payload.shipment !== 'string' || typeof payload.kind !== 'string') return { ok: false, error: 'Invalid payload' };
  return { ok: true, ref: `SHP-SIM-${payload.shipment.slice(-4)}-${String(n).padStart(3, '0')}` };
}

export async function runOutbox(db: DB, limit = 50): Promise<number> {
  const pending = await db.select().from(outbox).where(eq(outbox.state, 'pending')).limit(limit);
  let n = 0;
  for (const m of pending) {
    n++;
    const res: Sent = m.target === 'codex' ? simulateCodexDeposit(m.payload, n) : { ok: true, ref: null };
    await db.transaction(async (tx) => {
      if (res.ok) {
        await tx.update(outbox).set({ state: 'sent', sentAt: new Date(), attempts: m.attempts + 1, resultRef: res.ref }).where(eq(outbox.id, m.id));
        if (m.target === 'codex' && res.ref && m.shipmentId && typeof m.payload.kind === 'string')
          await tx.update(shipmentDocuments).set({ codexRef: res.ref, updatedAt: new Date(), updatedByName: 'Codex (simulation)' })
            .where(and(eq(shipmentDocuments.shipmentId, m.shipmentId), eq(shipmentDocuments.kind, m.payload.kind)));
      } else {
        await tx.update(outbox).set({ state: m.attempts + 1 >= 5 ? 'failed' : 'pending', attempts: m.attempts + 1, lastError: res.error }).where(eq(outbox.id, m.id));
      }
      await writeAudit(tx, { actorName: 'Connector (simulation)', actorUserId: null, objectRef: `Outbox ${m.target}`, change: `${m.kind} ${res.ok ? 'sent (simulated)' : 'failed'}`, area: 'Connectors' });
    });
  }
  return n;
}
