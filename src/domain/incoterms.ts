// Incoterms 2020: who organises and pays each step (seller = the group, buyer = the consignee). Same split as Keystone's
// R-158 table (docs/delivery-9/notes-r158-shipments.md § 3 in Keystone), so both tools tell the same story. Pure.
export const INCOTERM_STEPS = [
  'export_packing', 'loading', 'export_clearance', 'pre_carriage', 'main_carriage', 'insurance', 'unloading', 'import_clearance', 'on_carriage', 'duties',
] as const;
export type IncotermStep = (typeof INCOTERM_STEPS)[number];
export const INCOTERM_STEP_LABEL: Record<IncotermStep, string> = {
  export_packing: 'Export packing', loading: 'Loading at departure', export_clearance: 'Export clearance', pre_carriage: 'Pre-carriage',
  main_carriage: 'Main carriage', insurance: 'Insurance (risk in transit)', unloading: 'Unloading at destination', import_clearance: 'Import clearance',
  on_carriage: 'On-carriage to site', duties: 'Duties and taxes',
};

type Party = 'S' | 'B';
export interface Incoterm {
  code: string;
  name: string;
  seaOnly: boolean;
  split: Record<IncotermStep, Party>;
}

const row = (code: string, name: string, seaOnly: boolean, parts: string): Incoterm => ({
  code, name, seaOnly,
  split: Object.fromEntries(INCOTERM_STEPS.map((s, i) => [s, parts[i] as Party])) as Record<IncotermStep, Party>,
});

/** The 11 Incoterms 2020 (S = seller, B = buyer), in the order of the steps above. */
export const INCOTERMS: readonly Incoterm[] = [
  row('EXW', 'Ex Works', false, 'SBBBBBBBBB'),
  row('FCA', 'Free Carrier', false, 'SSSSBBBBBB'),
  row('CPT', 'Carriage Paid To', false, 'SSSSSBBBBB'),
  row('CIP', 'Carriage and Insurance Paid To', false, 'SSSSSSBBBB'),
  row('DAP', 'Delivered at Place', false, 'SSSSSSBBSB'),
  row('DPU', 'Delivered at Place Unloaded', false, 'SSSSSSSBSB'),
  row('DDP', 'Delivered Duty Paid', false, 'SSSSSSBSSS'),
  row('FAS', 'Free Alongside Ship', true, 'SSSSBBBBBB'),
  row('FOB', 'Free On Board', true, 'SSSSBBBBBB'),
  row('CFR', 'Cost and Freight', true, 'SSSSSBBBBB'),
  row('CIF', 'Cost, Insurance and Freight', true, 'SSSSSSBBBB'),
];

export const INCOTERM_BY_CODE: Record<string, Incoterm> = Object.fromEntries(INCOTERMS.map((i) => [i.code, i]));

/** Steps the group organises and pays under an Incoterm (as seller). For a purchase (group = buyer), the complement. */
export function groupSteps(code: string, groupIs: 'seller' | 'buyer' = 'seller'): IncotermStep[] {
  const i = INCOTERM_BY_CODE[code];
  if (!i) return [];
  const want: Party = groupIs === 'seller' ? 'S' : 'B';
  return INCOTERM_STEPS.filter((s) => i.split[s] === want);
}

/** A sea-only Incoterm with another mode: a warning, not a refusal (same as Keystone). */
export const seaOnlyMismatch = (code: string | null, mode: string | null) => !!code && !!mode && !!INCOTERM_BY_CODE[code]?.seaOnly && mode !== 'sea';

/** The seller must insure (CIF, CIP): minimum insured value = 110 % of the CIF / CIP value. */
export const sellerInsures = (code: string | null) => code === 'CIF' || code === 'CIP';
export const insuredValue = (cifValue: number) => Math.round(cifValue * 1.1 * 100) / 100;
