// Number and date display (pure). Amounts are k€ (N-2).
import type { Lang } from '@/i18n/translate';

const locale = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'en-GB');

/** "12 900 k€" / "12,900 k€". */
export const fmtKeur = (n: number | null | undefined, lang: Lang) => (n == null ? '—' : `${n.toLocaleString(locale(lang), { maximumFractionDigits: 1 })} k€`);

/** "22/10/2026" / "22 Oct 2026" from an ISO day or an instant (Paris day for an instant). */
export function fmtDate(v: string | Date | null | undefined, lang: Lang): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(`${v.slice(0, 10)}T12:00:00Z`) : v;
  return d.toLocaleDateString(locale(lang), { timeZone: 'Europe/Paris', day: '2-digit', month: lang === 'fr' ? '2-digit' : 'short', year: 'numeric' });
}

/** "22/10/2026 14:05". */
export const fmtInstant = (d: Date, lang: Lang) => `${fmtDate(d, lang)} ${d.toLocaleTimeString(locale(lang), { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}`;

/** "12 345,6" / "12,345.6". */
export const fmtNum = (n: number | null | undefined, lang: Lang, digits = 1) => (n == null ? '—' : n.toLocaleString(locale(lang), { maximumFractionDigits: digits }));

/** "12 345 €" / "USD 1,250". */
export function fmtMoney(n: number | null | undefined, currency: string, lang: Lang): string {
  if (n == null) return '—';
  return n.toLocaleString(locale(lang), { style: 'currency', currency, maximumFractionDigits: 0 });
}

/** "+3 d" / "−2 d" for a number of days. */
export const fmtDays = (n: number | null | undefined) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} d`);

/** "45 %" from a share. */
export const fmtPct = (n: number | null | undefined, lang: Lang) => (n == null ? '—' : `${(n * 100).toLocaleString(locale(lang), { maximumFractionDigits: 1 })} %`);
