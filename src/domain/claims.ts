// Claim deadlines by transport convention (docs/spec/04 § 1, choice C-4: usual values, to be confirmed by the legal team).
// Pure.
import { addDaysIso } from '@/lib/dates';
import type { IncidentType, Mode } from './vocab';

export type Regime = 'cmr' | 'montreal' | 'hague_visby' | 'contract';
export const REGIME_LABEL: Record<Regime, string> = {
  cmr: 'CMR (road)', montreal: 'Montreal Convention (air)', hague_visby: 'Hague-Visby Rules (sea)', contract: 'Carrier contract terms',
};

export const regimeOf = (mode: Mode): Regime => (mode === 'road' || mode === 'rail' ? 'cmr' : mode === 'air' || mode === 'express' ? 'montreal' : mode === 'sea' ? 'hague_visby' : 'contract');

/** Last day to send the written reserves / claim, from the delivery day; null when the regime has no fixed notice. */
export function noticeDeadline(regime: Regime, type: IncidentType, deliveredOn: string | null): string | null {
  if (!deliveredOn) return null;
  const days =
    regime === 'cmr' ? (type === 'delay' ? 21 : 7)
      : regime === 'montreal' ? (type === 'delay' ? 21 : 14)
        : regime === 'hague_visby' ? (type === 'delay' ? null : 3)
          : null;
  return days == null ? null : addDaysIso(deliveredOn, days);
}

/** Time bar of an action against the carrier (1 year for CMR and Hague-Visby, 2 years for Montreal). */
export function timeBar(regime: Regime, deliveredOn: string | null): string | null {
  if (!deliveredOn) return null;
  const years = regime === 'montreal' ? 2 : regime === 'contract' ? null : 1;
  if (years == null) return null;
  return `${+deliveredOn.slice(0, 4) + years}${deliveredOn.slice(4)}`;
}
