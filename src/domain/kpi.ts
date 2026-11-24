// Indicators (docs/spec/04 § 4) and carrier scores (docs/spec/02 § 1). Computed on every read from the shipments, never
// stored. Pure.
import { daysBetweenIso } from '@/lib/dates';
import type { Mode, ShipmentState } from './vocab';

export interface KpiShipment {
  state: ShipmentState;
  mode: Mode;
  partnerId: string | null;
  requestedOn: string | null;
  neededOn: string | null;
  bookedEta: string | null;
  atd: string | null;
  ata: string | null;
  deliveredOn: string | null;
  chargeableKg: number;
  valueEur: number | null;
  costEur: number | null;
  incidents: number;
  shortageIncidents: number;
  quotedEur: number | null;
  invoicedEur: number | null;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const ratio = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 1000 : null);

export interface Kpis {
  inProgress: number;
  delivered: number;
  /** Delivered by the date of need (+ tolerance) / delivered. */
  otd: number | null;
  /** Delivered by the confirmed ETA and without shortage / delivered. */
  otif: number | null;
  medianRequestToDeparture: number | null;
  transitByMode: Partial<Record<Mode, number>>;
  freightOverValue: number | null;
  costPerKgByMode: Partial<Record<Mode, number>>;
  invoiceVariance: number | null;
  airShareKg: number | null;
  incidentsPer100: number | null;
}

/** Indicators over the shipments of a period (the caller filters by period, site, mode). */
export function kpis(rows: readonly KpiShipment[], toleranceDays = 1): Kpis {
  const open: ShipmentState[] = ['planned', 'booked', 'picked_up', 'in_transit', 'arrived', 'on_hold'];
  const delivered = rows.filter((r) => r.deliveredOn && (r.state === 'delivered' || r.state === 'closed'));
  const onTime = delivered.filter((r) => r.neededOn && daysBetweenIso(r.neededOn, r.deliveredOn!) <= toleranceDays).length;
  const otifN = delivered.filter((r) => r.bookedEta && daysBetweenIso(r.bookedEta, r.deliveredOn!) <= toleranceDays && r.shortageIncidents === 0).length;
  const transit: Partial<Record<Mode, number[]>> = {};
  const costKg: Partial<Record<Mode, [number, number]>> = {};
  for (const r of rows) {
    if (r.atd && r.ata) (transit[r.mode] ??= []).push(daysBetweenIso(r.atd, r.ata));
    if (r.costEur != null && r.chargeableKg > 0) {
      const c = (costKg[r.mode] ??= [0, 0]);
      c[0] += r.costEur;
      c[1] += r.chargeableKg;
    }
  }
  const valued = rows.filter((r) => r.costEur != null && r.valueEur);
  const varRows = rows.filter((r) => r.quotedEur && r.invoicedEur != null);
  const qSum = varRows.reduce((a, r) => a + r.quotedEur!, 0);
  const totalKg = rows.reduce((a, r) => a + r.chargeableKg, 0);
  const airKg = rows.filter((r) => r.mode === 'air' || r.mode === 'express').reduce((a, r) => a + r.chargeableKg, 0);
  const shipped = rows.filter((r) => r.atd);
  return {
    inProgress: rows.filter((r) => open.includes(r.state)).length,
    delivered: delivered.length,
    otd: ratio(onTime, delivered.filter((r) => r.neededOn).length),
    otif: ratio(otifN, delivered.filter((r) => r.bookedEta).length),
    medianRequestToDeparture: median(rows.filter((r) => r.requestedOn && r.atd).map((r) => daysBetweenIso(r.requestedOn!, r.atd!))),
    transitByMode: Object.fromEntries(Object.entries(transit).map(([m, xs]) => [m, median(xs!)!])),
    freightOverValue: ratio(valued.reduce((a, r) => a + r.costEur!, 0), valued.reduce((a, r) => a + r.valueEur!, 0)),
    costPerKgByMode: Object.fromEntries(Object.entries(costKg).map(([m, [c, k]]) => [m, Math.round((c / k) * 100) / 100])),
    invoiceVariance: qSum ? Math.round(((varRows.reduce((a, r) => a + r.invoicedEur!, 0) - qSum) / qSum) * 1000) / 1000 : null,
    airShareKg: ratio(airKg, totalKg),
    incidentsPer100: shipped.length ? Math.round((shipped.reduce((a, r) => a + r.incidents, 0) / shipped.length) * 1000) / 10 : null,
  };
}

export interface CarrierStats {
  shipments: number;
  punctuality: number | null;
  incidentsPer100: number | null;
  invoiceVariance: number | null;
  /** Median RFQ answer time (hours) and answer rate. */
  answerHours: number | null;
  answerRate: number | null;
  awardRate: number | null;
}

export interface ScoreWeights {
  punctuality: number;
  incidents: number;
  variance: number;
  responsiveness: number;
}
/** Default weights (question D-11). */
export const DEFAULT_WEIGHTS: ScoreWeights = { punctuality: 0.4, incidents: 0.25, variance: 0.2, responsiveness: 0.15 };
/** Below this many shipments no score is shown. */
export const MIN_SHIPMENTS_FOR_SCORE = 5;

/** Carrier statistics over its shipments and its RFQ invitations. */
export function carrierStats(
  rows: readonly KpiShipment[],
  invitations: readonly { answeredHours: number | null; awarded: boolean }[],
  toleranceDays = 1,
): CarrierStats {
  const delivered = rows.filter((r) => r.deliveredOn && r.bookedEta);
  const punctual = delivered.filter((r) => daysBetweenIso(r.bookedEta!, r.deliveredOn!) <= toleranceDays).length;
  const shipped = rows.filter((r) => r.atd);
  const v = rows.filter((r) => r.quotedEur && r.invoicedEur != null);
  const q = v.reduce((a, r) => a + r.quotedEur!, 0);
  const answered = invitations.filter((i) => i.answeredHours != null);
  return {
    shipments: rows.length,
    punctuality: ratio(punctual, delivered.length),
    incidentsPer100: shipped.length ? Math.round((shipped.reduce((a, r) => a + r.incidents, 0) / shipped.length) * 1000) / 10 : null,
    invoiceVariance: q ? Math.round(((v.reduce((a, r) => a + r.invoicedEur!, 0) - q) / q) * 1000) / 1000 : null,
    answerHours: median(answered.map((i) => i.answeredHours!)),
    answerRate: ratio(answered.length, invitations.length),
    awardRate: ratio(invitations.filter((i) => i.awarded).length, answered.length),
  };
}

/** Score out of 100, null below the minimum number of shipments. */
export function carrierScore(s: CarrierStats, w: ScoreWeights = DEFAULT_WEIGHTS): number | null {
  if (s.shipments < MIN_SHIPMENTS_FOR_SCORE) return null;
  const parts: [number, number | null][] = [
    [w.punctuality, s.punctuality],
    [w.incidents, s.incidentsPer100 == null ? null : Math.max(0, 1 - s.incidentsPer100 / 20)],
    [w.variance, s.invoiceVariance == null ? null : Math.max(0, 1 - Math.abs(s.invoiceVariance) / 0.2)],
    [w.responsiveness, s.answerRate == null ? null : s.answerRate * (s.answerHours == null ? 1 : Math.max(0, 1 - s.answerHours / 120))],
  ];
  const used = parts.filter(([, v]) => v != null) as [number, number][];
  const wsum = used.reduce((a, [ww]) => a + ww, 0);
  if (!wsum) return null;
  return Math.round((used.reduce((a, [ww, v]) => a + ww * v, 0) / wsum) * 100);
}
