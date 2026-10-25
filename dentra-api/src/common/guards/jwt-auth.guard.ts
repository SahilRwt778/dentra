import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

/**
 * Registered globally via APP_GUARD in app.module.ts. Every route is
 * locked unless marked @Public() — auth failing closed by default, not
 * something each controller has to remember to add.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const payload = this.jwtService.verify<{
        sub: string;
        role: 'patient' | 'dentist' | 'admin';
        sid?: string;
        did?: string;
      }>(token);
      // Normalized to {userId, role} here so nothing downstream (CurrentUser,
      // RolesGuard, every controller) needs to know the JWT claim is
      // actually called `sub` — one place translates the standard JWT
      // convention into this app's own shape.
      request.user = { userId: payload.sub, role: payload.role, sessionId: payload.sid, deviceId: payload.did };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractToken(request: { headers: Record<string, string | undefined> }): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length);
  }
}
