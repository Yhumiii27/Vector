// Reference data of every new database, demonstration or production: the 11 Incoterms 2020, the countries in use with their
// zone, EU membership and default risk (to be validated by the compliance role, DA-6), packaging standards (DA-5) and cost
// standards (DA-7) as starting values. The administration changes them afterwards.
import { INCOTERMS } from '@/domain/incoterms';
import { costStandards, countries, incoterms, packagingStandards } from '../schema';
import type { Tx } from '../types';

export const REFERENCE_COUNTRIES: readonly { code: string; name: string; eu: boolean; zone: 'europe' | 'africa' | 'americas' | 'asia' | 'oceania' | 'middle_east'; risk?: 'none' | 'watch' | 'restricted' | 'embargoed'; origin?: 'none' | 'eur1' | 'certificate' }[] = [
  { code: 'FR', name: 'France', eu: true, zone: 'europe' },
  { code: 'DE', name: 'Germany', eu: true, zone: 'europe' },
  { code: 'BE', name: 'Belgium', eu: true, zone: 'europe' },
  { code: 'ES', name: 'Spain', eu: true, zone: 'europe' },
  { code: 'IT', name: 'Italy', eu: true, zone: 'europe' },
  { code: 'NL', name: 'Netherlands', eu: true, zone: 'europe' },
  { code: 'PL', name: 'Poland', eu: true, zone: 'europe' },
  { code: 'GB', name: 'United Kingdom', eu: false, zone: 'europe', origin: 'eur1' },
  { code: 'CH', name: 'Switzerland', eu: false, zone: 'europe', origin: 'eur1' },
  { code: 'MA', name: 'Morocco', eu: false, zone: 'africa', origin: 'eur1' },
  { code: 'CI', name: "Côte d'Ivoire", eu: false, zone: 'africa', origin: 'eur1' },
  { code: 'GH', name: 'Ghana', eu: false, zone: 'africa', origin: 'eur1' },
  { code: 'MR', name: 'Mauritania', eu: false, zone: 'africa', origin: 'certificate' },
  { code: 'ZA', name: 'South Africa', eu: false, zone: 'africa', origin: 'eur1' },
  { code: 'CL', name: 'Chile', eu: false, zone: 'americas', origin: 'eur1' },
  { code: 'PE', name: 'Peru', eu: false, zone: 'americas', origin: 'eur1' },
  { code: 'CA', name: 'Canada', eu: false, zone: 'americas', origin: 'eur1' },
  { code: 'AU', name: 'Australia', eu: false, zone: 'oceania', origin: 'certificate' },
  { code: 'SA', name: 'Saudi Arabia', eu: false, zone: 'middle_east', risk: 'watch', origin: 'certificate' },
  { code: 'KZ', name: 'Kazakhstan', eu: false, zone: 'asia', risk: 'restricted', origin: 'certificate' },
  { code: 'IR', name: 'Iran', eu: false, zone: 'middle_east', risk: 'embargoed', origin: 'certificate' },
];

export async function seedReference(tx: Tx): Promise<void> {
  await tx.insert(incoterms).values(INCOTERMS.map((i, n) => ({ code: i.code, name: i.name, seaOnly: i.seaOnly, position: n + 1 })));
  await tx.insert(countries).values(REFERENCE_COUNTRIES.map((c) => ({ code: c.code, name: c.name, eu: c.eu, zone: c.zone, risk: c.risk ?? 'none', originDocument: c.origin ?? 'none' })));
  await tx.insert(packagingStandards).values([
    { code: 'CAISSE-S', type: 'crate', lengthCm: 120, widthCm: 80, heightCm: 80, tareKg: 35, maxKg: 800, norm: 'ISPM 15' },
    { code: 'CAISSE-M', type: 'crate', lengthCm: 200, widthCm: 120, heightCm: 120, tareKg: 95, maxKg: 2000, norm: 'ISPM 15' },
    { code: 'CAISSE-L', type: 'crate', lengthCm: 400, widthCm: 220, heightCm: 220, tareKg: 420, maxKg: 8000, norm: 'HPE + ISPM 15' },
    { code: 'PAL-EUR', type: 'pallet', lengthCm: 120, widthCm: 80, heightCm: 15, tareKg: 25, maxKg: 1500, norm: 'ISPM 15' },
    { code: 'CARTON-50', type: 'box', lengthCm: 60, widthCm: 40, heightCm: 40, tareKg: 1.5, maxKg: 30, norm: null },
  ]);
  const std: [string, string, number][] = [
    ['road', 'europe', 0.18], ['sea', 'africa', 0.45], ['sea', 'americas', 0.55], ['sea', 'oceania', 0.6], ['sea', 'middle_east', 0.4], ['sea', 'asia', 0.5],
    ['air', 'africa', 4.2], ['air', 'americas', 5.1], ['air', 'oceania', 6.0], ['air', 'middle_east', 3.6], ['express', 'africa', 9.5], ['express', 'americas', 11], ['express', 'europe', 3.2],
  ];
  await tx.insert(costStandards).values(std.map(([mode, zone, eurPerKg]) => ({ mode, zone, eurPerKg })));
}
