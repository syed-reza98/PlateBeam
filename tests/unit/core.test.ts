import { describe, expect, it } from 'vitest';
import { resolveEffectivePermissions } from '../../src/server/core/rbac.service';
import {
  calculatePreTaxTipMinor,
  distributeMinorEqually,
  distributeMinorByWeights,
} from '../../src/server/core/billing.service';
import {
  generateSignedQrToken,
  verifySignedQrToken,
  haversineDistanceMeters,
} from '../../src/server/core/qr-security.service';

describe('RBAC 3-Layer Permission Engine', () => {
  it('correctly applies (Role Defaults + Grants) - Denies, with DENY always winning', () => {
    const roleDefaults = ['order:create', 'order:read', 'bill:view'];
    const overrides = [
      { permissionKey: 'discount:apply', effect: 'GRANT' as const },
      { permissionKey: 'order:create', effect: 'DENY' as const }, // Overrides role default!
    ];

    const effective = resolveEffectivePermissions(roleDefaults, overrides);
    expect(effective).toContain('order:read');
    expect(effective).toContain('bill:view');
    expect(effective).toContain('discount:apply');
    expect(effective).not.toContain('order:create'); // Denied!
  });
});

describe('Billing & Exact Integer Minor Currency Distribution', () => {
  it('distributes 1000 minor units across 3 equal splits without rounding drift', () => {
    const splits = distributeMinorEqually(1000, 3);
    expect(splits).toHaveLength(3);
    expect(splits.reduce((a, b) => a + b, 0)).toBe(1000);
    // 334, 333, 333
    expect(splits).toEqual([334, 333, 333]);
  });

  it('distributes minor units by weights with Hamilton largest remainder', () => {
    const distributed = distributeMinorByWeights(1000, [1, 2, 3]);
    expect(distributed.reduce((a, b) => a + b, 0)).toBe(1000);
    // 1000 / 6 = 166.666... -> [167, 333, 500]
    expect(distributed).toEqual([167, 333, 500]);
  });

  it('calculates pre-tax tip minor correctly', () => {
    const tip = calculatePreTaxTipMinor(10000, 15); // 15% on 100.00
    expect(tip).toBe(1500);
  });
});

describe('QR Security & HMAC Engine', () => {
  const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const outletId = '00000000-0000-0000-0000-000000000002';
  const tableId = '00000000-0000-0000-0000-000000000003';

  it('generates and verifies HMAC-signed QR tokens', () => {
    const token = generateSignedQrToken({ tenantId, outletId, tableId, secret });
    const verified = verifySignedQrToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.t).toBe(tenantId);
    expect(verified?.o).toBe(outletId);
    expect(verified?.tbl).toBe(tableId);

    const tampered = token.slice(0, -4) + 'abcd';
    expect(verifySignedQrToken(tampered, secret)).toBeNull();
  });

  it('computes haversine distance between coordinates accurately', () => {
    // Distance between 0,0 and 0,0 is 0
    expect(haversineDistanceMeters(0, 0, 0, 0)).toBe(0);

    // Known distance roughly 111km for 1 degree latitude
    const d = haversineDistanceMeters(23.777176, 90.399452, 23.777200, 90.399452);
    expect(d).toBeLessThan(10); // few meters apart
  });
});
