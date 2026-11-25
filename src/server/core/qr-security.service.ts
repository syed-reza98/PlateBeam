import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { QrSecurityPolicy } from '../db/types';
import type { RealtimePort } from '../ports/realtime.port';
import type {
  AuditRepository,
  DiningTableRecord,
  FloorRepository,
  GuestRecord,
  OutletRecord,
} from '../ports/repositories.port';
import { NotFoundError, SecurityPolicyError, ValidationError } from './errors';
import { writeAuditLog } from './rbac.service';

export interface QrTokenPayload {
  /** tenantId */
  t: string;
  /** outletId */
  o: string;
  /** tableId */
  tbl: string;
  /** random nonce for one-tap rotation */
  n: string;
  /** issued-at unix seconds */
  iat: number;
}

const DEFAULT_FALLBACK_SECRET = 'platebeam-dev-qr-hmac-secret-change-in-prod';

function getQrSecret(secret?: string): string {
  return secret || process.env.QR_HMAC_SECRET || DEFAULT_FALLBACK_SECRET;
}

function toBase64Url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

/**
 * Generates an opaque, non-sequential HMAC-SHA256 signed QR token (FR-001).
 */
export function generateSignedQrToken(input: {
  tenantId: string;
  outletId: string;
  tableId: string;
  secret?: string;
}): string {
  const payload: QrTokenPayload = {
    t: input.tenantId,
    o: input.outletId,
    tbl: input.tableId,
    n: randomBytes(6).toString('hex'),
    iat: Math.floor(Date.now() / 1000),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = createHmac('sha256', getQrSecret(input.secret))
    .update(encodedPayload)
    .digest();
  return `${encodedPayload}.${toBase64Url(sig)}`;
}

/**
 * Verifies an HMAC-SHA256 signed QR token using constant-time comparison.
 * Returns the decoded payload or null if invalid/tampered.
 */
export function verifySignedQrToken(
  token: string,
  secret?: string,
): QrTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const expectedSig = createHmac('sha256', getQrSecret(secret))
    .update(encodedPayload)
    .digest();
  const actualSig = fromBase64Url(encodedSig);

  if (expectedSig.length !== actualSig.length) return null;
  if (!timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const parsed = JSON.parse(
      fromBase64Url(encodedPayload).toString('utf8'),
    ) as QrTokenPayload;
    if (!parsed.t || !parsed.o || !parsed.tbl || !parsed.n) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * One-tap QR rotation (FR-002): revokes old token, persists new HMAC token,
 * writes immutable audit log, and broadcasts table update.
 */
export async function rotateTableQrToken(
  deps: {
    floor: FloorRepository;
    audit: AuditRepository;
    realtime?: RealtimePort;
  },
  input: {
    tenantId: string;
    outletId: string;
    tableId: string;
    actorUserId?: string | null;
    ipAddress?: string | null;
    secret?: string;
  },
): Promise<DiningTableRecord> {
  const existing = await deps.floor.findTableById(input.tenantId, input.tableId);
  if (!existing) {
    throw new NotFoundError('Dining table not found', { tableId: input.tableId });
  }

  const newToken = generateSignedQrToken({
    tenantId: input.tenantId,
    outletId: input.outletId,
    tableId: input.tableId,
    secret: input.secret,
  });

  const updated = await deps.floor.rotateTableQrToken(
    input.tenantId,
    input.tableId,
    newToken,
  );

  await writeAuditLog(deps.audit, {
    tenantId: input.tenantId,
    outletId: input.outletId,
    actorUserId: input.actorUserId ?? null,
    action: 'QR_TOKEN_ROTATED',
    entityType: 'dining_tables',
    entityId: input.tableId,
    beforeState: { qrTokenPrefix: existing.qrToken.slice(0, 12) },
    afterState: { qrTokenPrefix: updated.qrToken.slice(0, 12) },
    ipAddress: input.ipAddress ?? null,
  });

  if (deps.realtime) {
    await deps.realtime.publishToFloor(
      input.tenantId,
      input.outletId,
      'table.updated',
      { tableId: updated.id, qrRotatedAt: updated.qrRotatedAt },
    );
  }

  return updated;
}

/**
 * Haversine distance in meters between two WGS-84 coordinates.
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

/**
 * Checks whether clientIp matches any allowed exact IP or IPv4 CIDR block.
 */
export function isVenueIpAllowed(
  clientIp: string | undefined | null,
  allowedCidrs: readonly string[] | undefined,
): boolean {
  if (!allowedCidrs || allowedCidrs.length === 0) return true;
  if (!clientIp) return false;
  const normalizedIp = clientIp.replace(/^::ffff:/, '').trim();

  for (const entry of allowedCidrs) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (!trimmed.includes('/')) {
      if (normalizedIp === trimmed) return true;
      continue;
    }
    const [networkStr, prefixStr] = trimmed.split('/');
    const prefix = Number(prefixStr);
    const ipInt = ipv4ToInt(normalizedIp);
    const netInt = ipv4ToInt(networkStr ?? '');
    if (ipInt === null || netInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      continue;
    }
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if ((ipInt & mask) === (netInt & mask)) {
      return true;
    }
  }
  return false;
}

export interface QrScanSecurityEvaluation {
  allowed: boolean;
  distanceMeters?: number;
  requiresCaptainApproval: boolean;
  payFirstTakeaway: boolean;
}

/**
 * Evaluates all FR-004 anti-spoofing & fraud guardrails:
 * - Guest blocklist
 * - GPS geofence (default <= 100m)
 * - Venue Wi-Fi IP check
 * - Max unpaid order cap
 * - Captain Approval & Pay-First flags
 */
export function evaluateQrScanSecurity(input: {
  outlet: Pick<OutletRecord, 'geoLat' | 'geoLng' | 'qrSecurityPolicy'>;
  lat?: number;
  lng?: number;
  clientIp?: string | null;
  guest?: Pick<GuestRecord, 'isBlocked'> | null;
  openUnpaidOrderCount?: number;
  policyOverride?: Partial<QrSecurityPolicy>;
}): QrScanSecurityEvaluation {
  const policy: QrSecurityPolicy = {
    ...input.outlet.qrSecurityPolicy,
    ...input.policyOverride,
  };

  if (input.guest?.isBlocked) {
    throw new SecurityPolicyError(
      'This guest profile has been blocked from QR ordering at this venue.',
      'GUEST_BLOCKED',
    );
  }

  let distanceMeters: number | undefined;
  if (policy.requireGps) {
    if (input.outlet.geoLat == null || input.outlet.geoLng == null) {
      throw new ValidationError('Outlet GPS coordinates are not configured.');
    }
    if (input.lat == null || input.lng == null) {
      throw new SecurityPolicyError(
        'Location permission is required to verify you are at the restaurant.',
        'GPS_REQUIRED',
      );
    }
    const maxDist = policy.maxDistanceMeters ?? 100;
    distanceMeters = haversineDistanceMeters(
      input.outlet.geoLat,
      input.outlet.geoLng,
      input.lat,
      input.lng,
    );
    if (distanceMeters > maxDist) {
      throw new SecurityPolicyError(
        `You appear to be ${Math.round(distanceMeters)}m away (must be within ${maxDist}m).`,
        'GEOFENCE_OUT_OF_RANGE',
        { distanceMeters: Math.round(distanceMeters), maxDistanceMeters: maxDist },
      );
    }
  }

  if (policy.requireVenueIp) {
    if (!isVenueIpAllowed(input.clientIp, policy.allowedIpCidrs)) {
      throw new SecurityPolicyError(
        'Please connect to the venue Wi-Fi network to place QR orders.',
        'VENUE_IP_REQUIRED',
      );
    }
  }

  if (
    policy.maxUnpaidOrders != null &&
    policy.maxUnpaidOrders > 0 &&
    (input.openUnpaidOrderCount ?? 0) >= policy.maxUnpaidOrders
  ) {
    throw new SecurityPolicyError(
      `Maximum unpaid order limit (${policy.maxUnpaidOrders}) reached for this table. Please settle or request staff assistance.`,
      'MAX_UNPAID_ORDERS_REACHED',
      { maxUnpaidOrders: policy.maxUnpaidOrders },
    );
  }

  return {
    allowed: true,
    distanceMeters,
    requiresCaptainApproval: Boolean(policy.captainApprovalRequired),
    payFirstTakeaway: Boolean(policy.payFirstTakeaway),
  };
}

/**
 * Generates sequential numeric takeaway / counter token (FR-005).
 */
export function generatePayFirstTakeawayToken(input: {
  lastTokenNumber?: number | null;
  prefix?: string;
}): { tokenNumber: number; displayLabel: string } {
  const next = (input.lastTokenNumber ?? 0) + 1;
  const prefix = input.prefix ?? 'Token #';
  return {
    tokenNumber: next,
    displayLabel: `${prefix}${next}`,
  };
}
