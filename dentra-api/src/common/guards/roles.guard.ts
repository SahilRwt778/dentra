import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';

/**
 * Runs after JwtAuthGuard. A route with no @Roles(...) is open to any
 * authenticated role; one with @Roles('admin') rejects everyone else
 * with 403 — server-side, regardless of what the calling client's UI
 * allowed the user to click.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Not allowed for this role');
    }
    return true;
  }
}
