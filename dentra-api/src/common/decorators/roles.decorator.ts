import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Server-side role check — the one the prototype's UI-only role switch
 * never had. RolesGuard (see ../guards/roles.guard.ts) reads this and
 * rejects with 403 before the handler runs.
 */
export const Roles = (...roles: Array<'patient' | 'dentist' | 'admin'>) =>
  SetMetadata(ROLES_KEY, roles);
