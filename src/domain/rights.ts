// What each role may do in Vector (docs/spec/06 § 1). Pure; every Server Function asks these with the viewer's roles (cumulative)
// and the data layer filters what a requester sees.
import type { RoleKey } from '@/config/roles';

export type Right =
  | 'request' | 'triage' | 'prepare' | 'pack' | 'quote' | 'award_any' | 'track' | 'comply' | 'incident' | 'see_costs'
  | 'reconcile' | 'see_values' | 'partners' | 'see_partners' | 'reference' | 'see_all' | 'journal';

const RIGHTS: Record<RoleKey, readonly Right[]> = {
  manager: ['request', 'triage', 'prepare', 'pack', 'quote', 'award_any', 'track', 'comply', 'incident', 'see_costs', 'reconcile', 'see_values', 'partners', 'see_partners', 'reference', 'see_all', 'journal'],
  admin: ['request', 'see_costs', 'see_values', 'partners', 'see_partners', 'reference', 'see_all', 'journal'],
  coordinator: ['request', 'triage', 'prepare', 'pack', 'quote', 'track', 'incident', 'see_costs', 'see_values', 'see_partners', 'see_all'],
  compliance: ['comply', 'see_costs', 'see_values', 'see_partners', 'reference', 'see_all'],
  finance: ['see_costs', 'reconcile', 'see_values', 'see_partners', 'see_all'],
  packing: ['pack', 'incident', 'see_all'],
  requester: ['request', 'incident'],
  reader: ['see_partners', 'see_all'],
};

/** True when one of the roles carries the right. */
export const can = (roles: readonly RoleKey[], right: Right) => roles.some((r) => RIGHTS[r].includes(right));

/** Values and costs (question U-2). */
export const canSeeValues = (roles: readonly RoleKey[]) => can(roles, 'see_values');

/** Refusal message of a missing right (EN source string). */
export const FORBIDDEN = 'You do not have the right to do this';
