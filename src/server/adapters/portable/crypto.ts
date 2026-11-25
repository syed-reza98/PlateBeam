import { scrypt } from '@noble/hashes/scrypt';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils';

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, dkLen: 32 };

/**
 * Hashes a password or POS PIN using scrypt with a 16-byte random salt.
 * Format: `scrypt$N$r$p$<saltHex>$<hashHex>`
 */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const derived = scrypt(new TextEncoder().encode(secret), salt, SCRYPT_OPTS);
  return `scrypt$${SCRYPT_OPTS.N}$${SCRYPT_OPTS.r}$${SCRYPT_OPTS.p}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

/**
 * Constant-time verification of a password or POS PIN against a stored scrypt hash.
 */
export function verifySecret(secret: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const expectedHex = parts[5];
  if (!N || !r || !p || !saltHex || !expectedHex) {
    return false;
  }

  const salt = hexToBytes(saltHex);
  const expected = hexToBytes(expectedHex);
  const derived = scrypt(new TextEncoder().encode(secret), salt, {
    N,
    r,
    p,
    dkLen: expected.length,
  });

  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived[i] ^ expected[i];
  }
  return diff === 0;
}

/**
 * Resolves effective RBAC permissions: (Role Defaults + GRANTs) - DENYs.
 */
export function resolveEffectivePermissions(
  roleDefaults: string[],
  overrides: Array<{ permissionKey: string; effect: 'GRANT' | 'DENY' }>,
): string[] {
  const granted = new Set<string>(roleDefaults);
  const denied = new Set<string>();

  for (const ov of overrides) {
    if (ov.effect === 'GRANT') {
      granted.add(ov.permissionKey);
    } else if (ov.effect === 'DENY') {
      denied.add(ov.permissionKey);
    }
  }

  for (const key of denied) {
    granted.delete(key);
  }

  return Array.from(granted);
}
