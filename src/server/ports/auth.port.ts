/**
 * Hexagonal AuthPort contract.
 * Implemented by SupabaseAuthAdapter (default) or JwtArgonAuthAdapter (portable/MySQL).
 */

export interface AuthSessionClaims {
  userId: string;
  tenantId: string;
  outletId?: string | null;
  roleId: string;
  roleName: string;
  email: string;
  fullName: string;
  /** Effective permissions resolved via (Role Defaults + Grants) - Denies */
  permissions: string[];
}

export interface SignInInput {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface SignInResult {
  claims: AuthSessionClaims;
  accessToken?: string;
}

export interface AuthPort {
  /** Returns verified session claims for the current request, or null if unauthenticated. */
  getSessionClaims(req?: Request): Promise<AuthSessionClaims | null>;

  /** Throws an Unauthorized/Forbidden error if unauthenticated or missing required permissions. */
  requireStaff(
    req?: Request,
    requiredPermissions?: string[],
  ): Promise<AuthSessionClaims>;

  /** Fast 4/6-digit POS staff PIN verification for shared FOH terminals. */
  verifyPosPin(input: {
    tenantId: string;
    outletId?: string;
    pin: string;
    userId?: string;
  }): Promise<AuthSessionClaims | null>;

  /** Authenticates staff with email + password and sets session cookies where applicable. */
  signIn(input: SignInInput): Promise<SignInResult>;

  /** Terminates the current session. */
  signOut(): Promise<void>;
}
