import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a handler out of the global JwtAuthGuard — health checks and the
 * unauthenticated auth endpoints (otp/request, otp/verify, admin/login,
 * refresh) use this. Everything else is locked by default.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
