import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  role: 'patient' | 'dentist' | 'admin';
  sessionId?: string;
  deviceId?: string;
}

/**
 * Pulls the user JwtAuthGuard attached to the request — never trust a
 * userId/role passed in the request body instead of this.
 */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
