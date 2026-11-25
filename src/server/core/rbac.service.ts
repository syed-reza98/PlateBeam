import type {
  AuditLogRecord,
  AuditRepository,
  RbacRepository,
  RoleRecord,
  UserPermissionOverrideRecord,
  UserRecord,
} from '../ports/repositories.port';
import { ForbiddenError, NotFoundError } from './errors';

/**
 * Sensitive actions that must always produce an immutable audit log entry (FR-033).
 */
export const SENSITIVE_AUDIT_ACTIONS = new Set([
  'ORDER_ITEM_VOIDED',
  'DISCOUNT_APPLIED_OVER_15_PCT',
  'PAYMENT_REFUNDED',
  'PAYMENT_DUPLICATE_FLAGGED',
  'CUSTOMER_PII_EXPORTED',
  'PERMISSION_OVERRIDE_UPDATED',
  'QR_TOKEN_ROTATED',
  'LOW_RATING_MANAGER_ALERT',
  'SHIFT_CLOSED',
]);

export interface WriteAuditLogInput {
  tenantId: string;
  outletId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Computes effective permissions using the 3-layer RBAC formula (FR-033):
 * `(Role Default Permissions + Per-User Explicit GRANTs) - Per-User Explicit DENYs`
 * Explicit DENYs always win, even if the role or a grant includes the permission.
 */
export function resolveEffectivePermissions(
  roleDefaultPermissions: readonly string[],
  overrides: readonly Pick<UserPermissionOverrideRecord, 'permissionKey' | 'effect'>[],
): string[] {
  const effective = new Set<string>(roleDefaultPermissions);
  const denied = new Set<string>();

  for (const override of overrides) {
    if (override.effect === 'DENY') {
      denied.add(override.permissionKey);
    } else if (override.effect === 'GRANT') {
      effective.add(override.permissionKey);
    }
  }

  // Explicit DENY always wins
  for (const key of denied) {
    effective.delete(key);
  }

  return Array.from(effective).sort();
}

export function hasPermission(
  effectivePermissions: readonly string[],
  requiredPermission: string,
): boolean {
  if (effectivePermissions.includes('*')) {
    return true;
  }
  if (effectivePermissions.includes(requiredPermission)) {
    return true;
  }
  const [domain] = requiredPermission.split(':');
  if (domain && effectivePermissions.includes(`${domain}:*`)) {
    return true;
  }
  return false;
}

export function assertPermissions(
  effectivePermissions: readonly string[],
  requiredPermissions: readonly string[],
): void {
  const missing = requiredPermissions.filter(
    (perm) => !hasPermission(effectivePermissions, perm),
  );
  if (missing.length > 0) {
    throw new ForbiddenError(
      `Missing required permission(s): ${missing.join(', ')}`,
      { missingPermissions: missing },
    );
  }
}

export async function getUserEffectivePermissions(
  rbacRepo: RbacRepository,
  tenantId: string,
  userId: string,
): Promise<{
  user: UserRecord;
  role: RoleRecord;
  overrides: UserPermissionOverrideRecord[];
  permissions: string[];
}> {
  const user = await rbacRepo.findUserById(tenantId, userId);
  if (!user) {
    throw new NotFoundError('Staff user not found', { userId });
  }
  const role = await rbacRepo.findRoleById(tenantId, user.roleId);
  if (!role) {
    throw new NotFoundError('Assigned role not found', { roleId: user.roleId });
  }
  const overrides = await rbacRepo.listUserOverrides(tenantId, userId);
  const permissions = resolveEffectivePermissions(
    role.defaultPermissions ?? [],
    overrides,
  );
  return { user, role, overrides, permissions };
}

export async function writeAuditLog(
  auditRepo: AuditRepository,
  input: WriteAuditLogInput,
): Promise<AuditLogRecord> {
  return auditRepo.appendLog({
    tenantId: input.tenantId,
    outletId: input.outletId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeState: input.beforeState ?? null,
    afterState: input.afterState ?? null,
    ipAddress: input.ipAddress ?? null,
  });
}

export async function setUserPermissionOverride(
  deps: { rbac: RbacRepository; audit: AuditRepository },
  input: {
    tenantId: string;
    outletId?: string | null;
    actorUserId: string;
    targetUserId: string;
    permissionKey: string;
    effect: 'GRANT' | 'DENY';
    ipAddress?: string | null;
  },
): Promise<{
  override: UserPermissionOverrideRecord;
  effectivePermissions: string[];
}> {
  const existingOverrides = await deps.rbac.listUserOverrides(
    input.tenantId,
    input.targetUserId,
  );
  const prev = existingOverrides.find(
    (o) => o.permissionKey === input.permissionKey,
  );

  const override = await deps.rbac.upsertPermissionOverride({
    tenantId: input.tenantId,
    userId: input.targetUserId,
    permissionKey: input.permissionKey,
    effect: input.effect,
  });

  await writeAuditLog(deps.audit, {
    tenantId: input.tenantId,
    outletId: input.outletId ?? null,
    actorUserId: input.actorUserId,
    action: 'PERMISSION_OVERRIDE_UPDATED',
    entityType: 'user_permission_overrides',
    entityId: `${input.targetUserId}:${input.permissionKey}`,
    beforeState: prev ? { effect: prev.effect } : null,
    afterState: { effect: override.effect },
    ipAddress: input.ipAddress ?? null,
  });

  const resolved = await getUserEffectivePermissions(
    deps.rbac,
    input.tenantId,
    input.targetUserId,
  );

  return {
    override,
    effectivePermissions: resolved.permissions,
  };
}
