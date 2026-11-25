/**
 * Domain error hierarchy for PlateBeam core services.
 * Framework-agnostic; API routes map `statusCode` to HTTP responses.
 */

export class DomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code = 'DOMAIN_ERROR',
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Authentication required', details?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Insufficient permissions', details?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found', details?: Record<string, unknown>) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'State conflict', details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class SecurityPolicyError extends DomainError {
  constructor(message: string, code = 'SECURITY_POLICY_VIOLATION', details?: Record<string, unknown>) {
    super(message, code, 403, details);
  }
}
