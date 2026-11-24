// Export compliance checklist (docs/spec/03 § 2). Pure: which checks apply, their proposed state, and whether the
// checklist is cleared.
import type { CheckState, ComplianceCheck, CountryRisk } from './vocab';

export interface ComplianceFacts {
  international: boolean;
  destinationRisk: CountryRisk;
  transitRisks: readonly CountryRisk[];
  dualUseLines: number;
  dualUseLicence: boolean;
  dangerousGoodsLines: number;
  dgDeclaration: boolean;
}

/** The checks that apply and the state the rules propose (a person still records screening and waivers). */
export function proposedChecks(f: ComplianceFacts): Record<ComplianceCheck, CheckState> {
  const worst = [f.destinationRisk, ...f.transitRisks].reduce<CountryRisk>((a, r) => (RISK_ORDER[r] > RISK_ORDER[a] ? r : a), 'none');
  return {
    destination: !f.international ? 'na' : worst === 'embargoed' ? 'blocked' : worst === 'restricted' ? 'pending' : 'ok',
    screening: f.international ? 'pending' : 'na',
    dual_use: f.dualUseLines === 0 ? 'na' : f.dualUseLicence ? 'ok' : 'blocked',
    dangerous_goods: f.dangerousGoodsLines === 0 ? 'na' : f.dgDeclaration ? 'ok' : 'pending',
    end_use: f.international && worst === 'restricted' ? 'pending' : 'na',
  };
}

const RISK_ORDER: Record<CountryRisk, number> = { none: 0, watch: 1, restricted: 2, embargoed: 3 };

/** Cleared when every check is ok, not applicable or waived. */
export const complianceCleared = (states: readonly CheckState[]) => states.length > 0 && states.every((s) => s === 'ok' || s === 'na' || s === 'waived');

/** An embargoed country can never be waived: only Compliance may waive, and never an embargo. */
export function waiverBlockers(check: ComplianceCheck, destinationRisk: CountryRisk, reason: string, isCompliance: boolean): string[] {
  const b: string[] = [];
  if (!isCompliance) b.push('Only the compliance role waives a check');
  if (check === 'destination' && destinationRisk === 'embargoed') b.push('An embargoed destination cannot be waived');
  if (!reason.trim()) b.push('A reason is required');
  return b;
}
