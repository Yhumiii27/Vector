import 'server-only';
// Simulated tracking connector (docs/spec/02 § 4, question D-14): produces the events a tracking API (project44, Shippeo,
// DCSA carriers' APIs) would send — the next planned milestone of a shipment in transit whose planned date has come — and
// applies them to the milestones (source `tracking`). Never calls out; a real provider replaces `nextEvents` once validated.
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';
import { milestones, shipments, trackingEvents } from '@/server/db/schema';
import type { DB } from '@/server/db/types';
import { writeAudit } from '@/server/db/helpers';

/** Milestones a provider would report today: planned on or before today, no actual date, on a shipment in transit. */
export async function simulateTracking(db: DB, today: string): Promise<number> {
  const rows = await db.select({ shipmentId: milestones.shipmentId, code: milestones.code, plannedOn: milestones.plannedOn, place: milestones.place, ref: shipments.ref })
    .from(milestones).innerJoin(shipments, eq(shipments.id, milestones.shipmentId))
    .where(and(inArray(shipments.state, ['in_transit', 'picked_up']), isNull(milestones.actualOn), lte(milestones.plannedOn, today), inArray(milestones.code, ['transshipment', 'gate_in', 'loaded'])));
  for (const r of rows) {
    await db.transaction(async (tx) => {
      await tx.insert(trackingEvents).values({ shipmentId: r.shipmentId, code: r.code, occurredOn: r.plannedOn!, place: r.place, provider: 'simulation', applied: true });
      await tx.update(milestones).set({ actualOn: r.plannedOn, source: 'tracking', updatedAt: new Date() }).where(and(eq(milestones.shipmentId, r.shipmentId), eq(milestones.code, r.code)));
      await writeAudit(tx, { actorName: 'Tracking (simulation)', actorUserId: null, objectRef: r.ref, change: `milestone ${r.code} reported by the tracking simulation`, area: 'Connectors' });
    });
  }
  return rows.length;
}
