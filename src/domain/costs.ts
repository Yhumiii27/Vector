// Costs of a shipment (docs/spec/04 § 3): estimate from the cost standards, quoted, invoiced, variance and conversion to
// euros. Pure; amounts in their currency, converted with the rate table passed in.
import type { CostCategory, Mode, Zone } from './vocab';

export interface Rate {
  currency: string;
  /** Units of the currency for 1 EUR, on `on`. */
  perEur: number;
  on: string;
}

/** The rate of a currency on a day: the latest one on or before it (EUR = 1); null when unknown. */
export function rateOn(rates: readonly Rate[], currency: string, day: string): number | null {
  if (currency === 'EUR') return 1;
  let best: Rate | null = null;
  for (const r of rates) if (r.currency === currency && r.on <= day && (!best || r.on > best.on)) best = r;
  return best?.perEur ?? null;
}

/** Amount in euros, null when the rate is unknown. */
export function toEur(amount: number, currency: string, day: string, rates: readonly Rate[]): number | null {
  const r = rateOn(rates, currency, day);
  return r ? Math.round((amount / r) * 100) / 100 : null;
}

export interface CostStandard {
  mode: Mode;
  zone: Zone;
  eurPerKg: number;
}

/** Estimate of the freight from the chargeable weight and the standard of the mode and zone; null without a standard. */
export function estimateFreight(standards: readonly CostStandard[], mode: Mode, zone: Zone, chargeableKg: number): number | null {
  const s = standards.find((x) => x.mode === mode && x.zone === zone);
  return s ? Math.round(s.eurPerKg * chargeableKg * 100) / 100 : null;
}

export interface CostLine {
  category: CostCategory;
  currency: string;
  estimated: number | null;
  quoted: number | null;
  invoiced: number | null;
  invoiceDate: string | null;
  reconciled: boolean;
}

export interface CostSummary {
  estimatedEur: number;
  quotedEur: number;
  invoicedEur: number;
  /** Invoiced − quoted, on the lines that have both (EUR). */
  varianceEur: number;
  /** Variance / quoted of the same lines; null without such lines. */
  variancePct: number | null;
  /** Lines with an invoice beyond the threshold and not reconciled. */
  toExplain: number;
  /** Lines whose currency has no rate. */
  unconverted: number;
}

/** Summary in euros; `threshold` = share above which a variance needs a reason (default 5 %, choice C-3). */
export function costSummary(lines: readonly CostLine[], rates: readonly Rate[], today: string, threshold = 0.05): CostSummary {
  let est = 0, quo = 0, inv = 0, vq = 0, vi = 0, toExplain = 0, unconverted = 0;
  for (const l of lines) {
    const day = l.invoiceDate ?? today;
    const c = (v: number | null) => (v == null ? 0 : toEur(v, l.currency, day, rates));
    const e = c(l.estimated), q = c(l.quoted), i = c(l.invoiced);
    if (e == null || q == null || i == null) {
      unconverted++;
      continue;
    }
    est += e;
    quo += q;
    inv += i;
    if (l.quoted != null && l.invoiced != null) {
      vq += q;
      vi += i;
      if (!l.reconciled && q > 0 && Math.abs(i - q) / q > threshold) toExplain++;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    estimatedEur: r2(est), quotedEur: r2(quo), invoicedEur: r2(inv), varianceEur: r2(vi - vq),
    variancePct: vq > 0 ? Math.round(((vi - vq) / vq) * 1000) / 1000 : null, toExplain, unconverted,
  };
}

/** Reconciled when every invoiced line is reconciled (no invoice yet: false). */
export const costsReconciled = (lines: readonly Pick<CostLine, 'invoiced' | 'reconciled'>[]) =>
  lines.some((l) => l.invoiced != null) && lines.every((l) => l.invoiced == null || l.reconciled);
