// Vector's roles (question U-1), read in Clavis (clavis.pub_acces, role keys `Vector.Manager`…) — cumulative. Pure registry:
// no component, no server import, so server code, the proxy and scripts can load it.

/** Role keys, from the broadest to the narrowest (the first one held is shown as the person's role). */
export const ROLE_KEYS = ['manager', 'admin', 'coordinator', 'compliance', 'finance', 'packing', 'requester', 'reader'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const isRoleKey = (v: unknown): v is RoleKey => typeof v === 'string' && (ROLE_KEYS as readonly string[]).includes(v);

/** Role names (EN source strings, translated through t()). */
export const ROLE_LABEL: Record<RoleKey, string> = {
  manager: 'Shipping manager',
  admin: 'Administrator',
  coordinator: 'Logistics coordinator',
  compliance: 'Customs and compliance',
  finance: 'Finance',
  packing: 'Warehouse and packing',
  requester: 'Requester',
  reader: 'Reader',
};

/** Role key in Clavis's catalogue (`Vector.Manager`). */
export const CLAVIS_ROLE: Record<RoleKey, string> = Object.fromEntries(
  ROLE_KEYS.map((r) => [r, `Vector.${r[0].toUpperCase()}${r.slice(1)}`]),
) as Record<RoleKey, string>;

/** Distinct known roles in priority order (unknown values dropped). */
export function sortRoles(roles: Iterable<unknown>): RoleKey[] {
  const held = new Set<string>();
  for (const r of roles) if (isRoleKey(r)) held.add(r);
  return ROLE_KEYS.filter((r) => held.has(r));
}

/** Active role: `preferred` when the user holds it, else the highest role held; null when the user holds none. */
export function activeRoleOf(roles: readonly string[], preferred?: string | null): RoleKey | null {
  const held = sortRoles(roles);
  if (preferred && isRoleKey(preferred) && held.includes(preferred)) return preferred;
  return held[0] ?? null;
}
