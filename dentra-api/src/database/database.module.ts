import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';
import type { AppConfig } from '@config/configuration';

export const PG_POOL = 'PG_POOL';

// node-postgres parses `date` columns (OID 1082) into a JS Date set to
// local midnight, which then serializes to JSON a day off in any
// timezone east of UTC (e.g. 1996-04-14 becomes "1996-04-13T18:30:00Z"
// in IST) — a real bug this caught when a registered patient's own
// dateOfBirth came back wrong. schema.sql's date columns carry no time
// component, so hand the raw "YYYY-MM-DD" string back unparsed instead.
types.setTypeParser(1082, (value: string) => value);

// Same class of bug for `time` columns (OID 1083): pg returns "10:00:00"
// (with seconds), not the "HH:MM" every clinic-hours/video-hours DTO
// validates and every openapi.yaml example uses — caught when a
// dentist's own clinic hours came back in a shape their own PATCH
// request would have rejected. Truncate once, here, for every caller.
types.setTypeParser(1083, (value: string) => value.slice(0, 5));

/**
 * One shared pg.Pool, injected wherever a module needs a raw query —
 * schema.sql is plain SQL (not an ORM schema), so modules write
 * parameterized queries against it directly rather than through a
 * generated client. @Global so every feature module gets it without
 * re-importing DatabaseModule each time.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) =>
        new Pool({ connectionString: config.get('databaseUrl', { infer: true }) }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Without this, app.close() (every e2e test, every graceful shutdown)
  // leaves open connections behind — Jest's "worker failed to exit
  // gracefully" warning was this leak, not a flaky test.
  async onModuleDestroy() {
    await this.pool.end();
  }
}
