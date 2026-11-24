// Carrier statistics of a partner over 12 months (src/domain/kpi.ts), from the world (pure).
import { carrierScore, carrierStats } from '@/domain/kpi';
import { addDaysIso } from '@/lib/dates';
import type { World } from '@/server/dal/world';
import { kpiRows } from './view-helpers';

export function partnerStats(w: World, partnerId: string, today: string) {
  const since = addDaysIso(today, -365);
  const views = w.shipments.filter((v) => (v.booking?.partnerId ?? v.awarded?.partnerId) === partnerId && (v.s.atd ?? v.s.etd ?? today) >= since);
  const invitations = w.shipments.flatMap((v) => v.rfqs.flatMap((r) => r.invited.filter((i) => i.partnerId === partnerId).map((i) => ({
    answeredHours: i.answeredAt && r.sentAt ? Math.round((i.answeredAt.getTime() - r.sentAt.getTime()) / 3_600_000) : null,
    awarded: r.quotes.some((q) => q.partnerId === partnerId && q.state === 'awarded'),
  }))));
  const stats = carrierStats(kpiRows(views), invitations);
  return { views, stats, score: carrierScore(stats) };
}
