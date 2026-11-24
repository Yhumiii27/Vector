// ETA and lateness (docs/spec/02 § 4). Pure; dates are ISO days.
import { addDaysIso, daysBetweenIso } from '@/lib/dates';
import type { MilestoneCode } from './vocab';

export interface EtaFacts {
  /** Latest ETA typed by the team (from the forwarder's messages), if any. */
  latestEta: string | null;
  /** ETA confirmed at booking. */
  bookedEta: string | null;
  etd: string | null;
  transitDays: number | null;
  ata: string | null;
  deliveredOn: string | null;
  /** Date of need of the request(s). */
  neededOn: string | null;
}

/** Current ETA: the latest typed, else the booked one, else ETD + quoted transit time. */
export function currentEta(f: Pick<EtaFacts, 'latestEta' | 'bookedEta' | 'etd' | 'transitDays'>): string | null {
  if (f.latestEta) return f.latestEta;
  if (f.bookedEta) return f.bookedEta;
  if (f.etd && f.transitDays != null) return addDaysIso(f.etd, f.transitDays);
  return null;
}

export interface Lateness {
  eta: string | null;
  /** Days beyond the date of need, forecast from the current ETA (positive = late), null without both. */
  forecastDays: number | null;
  /** Days delivered after the confirmed ETA (positive = late), null until delivered. */
  actualDays: number | null;
  /** Forecast late beyond the tolerance and not delivered yet. */
  atRisk: boolean;
}

export function lateness(f: EtaFacts, toleranceDays = 1): Lateness {
  const eta = currentEta(f);
  const forecastDays = !f.deliveredOn && eta && f.neededOn ? daysBetweenIso(f.neededOn, eta) : null;
  const ref = f.bookedEta ?? f.latestEta;
  const actualDays = f.deliveredOn && ref ? daysBetweenIso(ref, f.deliveredOn) : null;
  return { eta, forecastDays, actualDays, atRisk: forecastDays != null && forecastDays > toleranceDays };
}

export interface MilestoneRow {
  code: MilestoneCode;
  plannedOn: string | null;
  actualOn: string | null;
}

/** Milestones whose planned date is passed without an actual date. */
export const lateMilestones = (rows: readonly MilestoneRow[], today: string) => rows.filter((m) => m.plannedOn && !m.actualOn && m.plannedOn < today);

/** A cut-off within `hours` (default 48 h) from now and not passed: an alert of the home page and the calendar. */
export function cutoffSoon(cutoff: Date | null, now: Date, hours = 48): boolean {
  if (!cutoff) return false;
  const ms = cutoff.getTime() - now.getTime();
  return ms >= 0 && ms <= hours * 3_600_000;
}
