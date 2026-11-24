import { describe, expect, it } from 'vitest';
import { CLAVIS_ROLE, activeRoleOf } from '@/config/roles';
import { can, canSeeValues } from './rights';
import { emailFromClaims, grantedRolesFromClavisAccess, isPublicPath, safeReturnTo, vectorRoleKeys } from './auth';

describe('roles read in Clavis', () => {
  it('maps Clavis role keys', () => {
    expect(CLAVIS_ROLE.manager).toBe('Vector.Manager');
    expect(vectorRoleKeys(['Vector.Coordinator', 'vector:finance', 'Keystone.Admin', 'reader'])).toEqual(['coordinator', 'finance', 'reader']);
  });
  it('an access that is not open grants nothing (fail closed)', () => {
    expect(grantedRolesFromClavisAccess(null)).toEqual([]);
    expect(grantedRolesFromClavisAccess({ ouvert: false, role: 'Vector.Manager' })).toEqual([]);
    expect(grantedRolesFromClavisAccess({ ouvert: true, role: 'Vector.Manager', roles: ['Vector.Finance'] })).toEqual(['manager', 'finance']);
  });
  it('active role', () => {
    expect(activeRoleOf(['reader', 'coordinator'])).toBe('coordinator');
    expect(activeRoleOf(['reader', 'coordinator'], 'reader')).toBe('reader');
    expect(activeRoleOf([])).toBeNull();
  });
});

describe('rights', () => {
  it('values and costs only for the roles of U-2', () => {
    expect(canSeeValues(['requester'])).toBe(false);
    expect(canSeeValues(['packing', 'reader'])).toBe(false);
    expect(canSeeValues(['finance'])).toBe(true);
    expect(can(['coordinator'], 'award_any')).toBe(false);
    expect(can(['requester', 'compliance'], 'comply')).toBe(true);
  });
});

describe('sign-in helpers', () => {
  it('e-mail, return path and public paths', () => {
    expect(emailFromClaims({ preferred_username: 'A.B@Groupe.Example' })).toBe('a.b@groupe.example');
    expect(emailFromClaims({})).toBeNull();
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('/shipments?x=1')).toBe('/shipments?x=1');
    expect(isPublicPath('/api/auth/callback')).toBe(true);
    expect(isPublicPath('/shipments')).toBe(false);
  });
});
