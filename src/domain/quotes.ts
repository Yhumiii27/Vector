// Quote comparison and award rules (docs/spec/02 § 2). Pure.
import { toEur, type Rate } from './costs';

export interface QuoteRow {
  id: string;
  partnerName: string;
  amount: number;
  currency: string;
  transitDays: number;
  validUntil: string;
  state: 'received' | 'awarded' | 'declined' | 'expired';
}

export interface RankedQuote extends QuoteRow {
  eur: number | null;
  expired: boolean;
  cheapest: boolean;
  fastest: boolean;
  /** Cost + estimated cost of delay (days beyond the fastest × daily delay cost). */
  value: number | null;
  rank: number;
}

/** Ranks the quotes by value (cost + delay penalty); `dailyDelayCost` in euros per day (0 = by cost only). */
export function rankQuotes(quotes: readonly QuoteRow[], rates: readonly Rate[], today: string, dailyDelayCost = 0): RankedQuote[] {
  const live = quotes.filter((q) => q.state !== 'declined');
  const eurs = live.map((q) => toEur(q.amount, q.currency, today, rates));
  const minEur = Math.min(...eurs.filter((e): e is number => e != null));
  const minDays = Math.min(...live.map((q) => q.transitDays));
  const rows = live.map((q, i) => {
    const eur = eurs[i];
    const value = eur == null ? null : Math.round((eur + (q.transitDays - minDays) * dailyDelayCost) * 100) / 100;
    return { ...q, eur, expired: q.validUntil < today, cheapest: eur != null && eur === minEur, fastest: q.transitDays === minDays, value, rank: 0 };
  });
  rows.sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity) || a.transitDays - b.transitDays);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export interface AwardPolicy {
  /** Above this (EUR), the shipping manager validates the award (D-5). */
  approvalEur: number;
  /** Above this estimate (EUR), `minQuotes` are required (D-6). */
  competitionEur: number;
  minQuotes: number;
}

export const DEFAULT_AWARD_POLICY: AwardPolicy = { approvalEur: 10_000, competitionEur: 5_000, minQuotes: 3 };

/** Why an award is refused or needs more (EN source strings), given who awards. */
export function awardBlockers(
  q: RankedQuote,
  all: readonly RankedQuote[],
  ctx: { isManager: boolean; reason: string; critical: boolean; estimateEur: number | null },
  policy: AwardPolicy = DEFAULT_AWARD_POLICY,
): string[] {
  const b: string[] = [];
  if (q.state !== 'received') b.push('Only a received quote can be awarded');
  if (q.expired) b.push('The quote has expired');
  if (q.eur == null) b.push('No exchange rate for the currency of the quote');
  if (!q.cheapest && !ctx.reason.trim()) b.push('A reason is required when the cheapest quote is not chosen');
  const received = all.filter((x) => x.state === 'received' || x.state === 'awarded').length;
  if (!ctx.critical && (ctx.estimateEur ?? q.eur ?? 0) > policy.competitionEur && received < policy.minQuotes && !ctx.reason.trim())
    b.push(`Fewer than ${policy.minQuotes} quotes: a reason is required`);
  if (!ctx.isManager && (q.eur ?? 0) > policy.approvalEur) b.push('Above the approval threshold, the shipping manager awards');
  return b;
}
