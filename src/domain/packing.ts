// Packing totals, chargeable weight, gauge and fill rate (docs/spec/01 § 3). Pure, computed on every read, never stored.
import type { LoadType, Mode, FreightType } from './vocab';

export interface PackageInput {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  grossKg: number;
  netKg: number;
  stackable?: boolean;
}

export interface LineInput {
  quantity: number;
  unitValue: number;
  currency: string;
  hsCode: string | null;
  originCountry: string | null;
  netKg: number | null;
  unNumber?: string | null;
  dualUseCode?: string | null;
}

/** Volume of a package in m³ (3 decimals). */
export const volumeM3 = (p: Pick<PackageInput, 'lengthCm' | 'widthCm' | 'heightCm'>) => Math.round((p.lengthCm * p.widthCm * p.heightCm) / 1000) / 1000;

export interface PackingTotals {
  packages: number;
  grossKg: number;
  netKg: number;
  volumeM3: number;
}

export function packingTotals(pkgs: readonly PackageInput[]): PackingTotals {
  const r = { packages: pkgs.length, grossKg: 0, netKg: 0, volumeM3: 0 };
  for (const p of pkgs) {
    r.grossKg += p.grossKg;
    r.netKg += p.netKg;
    r.volumeM3 += volumeM3(p);
  }
  return { ...r, grossKg: round(r.grossKg, 1), netKg: round(r.netKg, 1), volumeM3: round(r.volumeM3, 3) };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

/** Volumetric factors (kg per m³) — choice C-1 of docs/DECISIONS.md, overridable by the administration. */
export const VOLUMETRIC = {
  /** IATA 1:6000 → 166.67 kg/m³. */
  air: 1_000_000 / 6000,
  /** Express integrators 1:5000 → 200 kg/m³. */
  express: 1_000_000 / 5000,
  /** Road groupage 1:3 → 333 kg/m³. */
  road: 333,
  /** Sea groupage: 1 t = 1 m³ (revenue ton). */
  sea: 1000,
  rail: 333,
} as const;

export interface Chargeable {
  /** Chargeable weight in kg (or revenue tons × 1000 for sea groupage). */
  kg: number;
  /** Which of weight and volume decided. */
  basis: 'weight' | 'volume';
  /** Sea groupage: revenue tons (W/M). */
  revenueTons: number | null;
  /** Full loads and charters are priced per unit: the figure is indicative only. */
  indicative: boolean;
}

/** Chargeable weight of a consignment for a mode (docs/spec/01 § 3.3). */
export function chargeableWeight(t: Pick<PackingTotals, 'grossKg' | 'volumeM3'>, mode: Mode, freight: FreightType | null, factors: Partial<typeof VOLUMETRIC> = {}): Chargeable {
  const f = { ...VOLUMETRIC, ...factors };
  const indicative = freight === 'fcl' || freight === 'ftl' || freight === 'air_charter' || freight === 'breakbulk' || freight === 'roro';
  const perM3 = mode === 'air' ? f.air : mode === 'express' ? f.express : mode === 'sea' ? f.sea : mode === 'rail' ? f.rail : f.road;
  const volKg = t.volumeM3 * perM3;
  const kg = round(Math.max(t.grossKg, volKg), 1);
  const basis = volKg > t.grossKg ? 'volume' : 'weight';
  const revenueTons = mode === 'sea' ? round(Math.max(t.grossKg / 1000, t.volumeM3), 3) : null;
  return { kg, basis, revenueTons, indicative };
}

/** Usable inside dimensions (cm) and payload (kg) of each load type — choice C-2. Breakbulk: no limit (null). */
export const LOAD_GAUGE: Record<LoadType, { l: number; w: number; h: number; kg: number } | null> = {
  truck: { l: 1360, w: 248, h: 270, kg: 24_000 },
  c20: { l: 589, w: 235, h: 239, kg: 28_200 },
  c40: { l: 1203, w: 235, h: 239, kg: 26_700 },
  c40hc: { l: 1203, w: 235, h: 269, kg: 26_500 },
  open_top: { l: 1203, w: 235, h: 9999, kg: 26_600 },
  flat_rack: { l: 1203, w: 9999, h: 9999, kg: 40_000 },
  hold: null,
  deck: null,
  uld: { l: 318, w: 224, h: 162, kg: 6_800 },
};

/** Heavy-lift threshold (kg), choice C-3. */
export const HEAVY_LIFT_KG = 10_000;

/** A package that does not fit the gauge of its load (any orientation on the floor) or is a heavy lift. */
export function outOfGauge(p: PackageInput, load: LoadType | null, heavyKg = HEAVY_LIFT_KG): { oog: boolean; heavy: boolean } {
  const heavy = p.grossKg >= heavyKg;
  const g = load ? LOAD_GAUGE[load] : LOAD_GAUGE.truck;
  if (!g) return { oog: false, heavy };
  const fitsFlat = (a: number, b: number) => a <= g.l && b <= g.w;
  const oog = !(fitsFlat(p.lengthCm, p.widthCm) || fitsFlat(p.widthCm, p.lengthCm)) || p.heightCm > g.h;
  return { oog, heavy };
}

export interface FillRate {
  /** Share of the usable volume (0–1+), null when the load has no gauge. */
  volume: number | null;
  /** Share of the payload. */
  weight: number | null;
  overweight: boolean;
}

/** Fill rate of a load from the packages put in it. */
export function fillRate(load: LoadType, pkgs: readonly PackageInput[]): FillRate {
  const g = LOAD_GAUGE[load];
  if (!g) return { volume: null, weight: null, overweight: false };
  const t = packingTotals(pkgs);
  const cap = load === 'open_top' || load === 'flat_rack' ? null : (g.l * g.w * g.h) / 1e6;
  const weight = round(t.grossKg / g.kg, 3);
  return { volume: cap ? round(t.volumeM3 / cap, 3) : null, weight, overweight: t.grossKg > g.kg };
}

/** Customs summary per HS code and origin (value per currency, net weight). */
export interface HsSummaryRow {
  hsCode: string;
  originCountry: string;
  currency: string;
  value: number;
  netKg: number;
  lines: number;
}

export function hsSummary(lines: readonly LineInput[]): { rows: HsSummaryRow[]; missingHs: number; missingOrigin: number } {
  const map = new Map<string, HsSummaryRow>();
  let missingHs = 0;
  let missingOrigin = 0;
  for (const l of lines) {
    if (!l.hsCode) missingHs++;
    if (!l.originCountry) missingOrigin++;
    const hs = l.hsCode ?? '—';
    const or = l.originCountry ?? '—';
    const key = `${hs}|${or}|${l.currency}`;
    const r = map.get(key) ?? { hsCode: hs, originCountry: or, currency: l.currency, value: 0, netKg: 0, lines: 0 };
    r.value = round(r.value + l.quantity * l.unitValue, 2);
    r.netKg = round(r.netKg + (l.netKg ?? 0), 1);
    r.lines++;
    map.set(key, r);
  }
  return { rows: [...map.values()].sort((a, b) => (a.hsCode === '—' ? 1 : 0) - (b.hsCode === '—' ? 1 : 0) || a.hsCode.localeCompare(b.hsCode)), missingHs, missingOrigin };
}

/** Value of the goods per currency. */
export function valueByCurrency(lines: readonly LineInput[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) out[l.currency] = round((out[l.currency] ?? 0) + l.quantity * l.unitValue, 2);
  return out;
}

/** "SH-2026-0012 / 3 of 7" shipping mark of a package (EN source; the number part is not translated). */
export const packageMark = (shipmentRef: string, n: number, of: number) => `${shipmentRef} / ${n}/${of}`;

/** Prorata of a total over shares (e.g. a grouped shipment's cost over the requests' chargeable weights), rounded to the cent, summing exactly. */
export function prorata(total: number, shares: readonly number[]): number[] {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (!shares.length) return [];
  if (sum <= 0) return shares.map((_, i) => (i === 0 ? round(total, 2) : 0));
  const cents = Math.round(total * 100);
  const raw = shares.map((s) => (cents * s) / sum);
  const floor = raw.map(Math.floor);
  let left = cents - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floor[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floor[i]++;
    left--;
  }
  return floor.map((c) => c / 100);
}
