import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { ALLOW_UNVERIFIED_DENTIST_KEY } from '@common/decorators/allow-unverified-dentist.decorator';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';

@Injectable()
export class DentistAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (user?.role !== 'dentist') return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_DENTIST_KEY, targets)) return true;

    // Check live state, not a JWT claim: rejection/disable also revokes an existing session's access.
    const { rows } = await this.pool.query(
      `select d.status from dentists d join users u on u.id = d.user_id
       where d.user_id = $1 and u.status = 'active'`,
      [user.userId],
    );
    if (rows[0]?.status !== 'verified') {
      throw new ForbiddenException('Your dentist application must be approved by an admin before you can access the clinic portal.');
    }
    return true;
  }
}
