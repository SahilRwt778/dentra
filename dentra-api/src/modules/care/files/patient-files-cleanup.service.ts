import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import { PatientFilesStorage } from './patient-files.storage';

@Injectable()
export class PatientFilesCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PatientFilesCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<number>;
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly storage: PatientFilesStorage,
    private readonly config: ConfigService
  ) {}

  onApplicationBootstrap() {
    if (this.config.get('nodeEnv') === 'test') return;
    const tick = () => {
      if (this.running) return;
      this.running = this.runOnce();
      void this.running
        .catch(() =>
          this.logger.error(
            'Could not clean up unused patient uploads; will retry.'
          )
        )
        .finally(() => {
          this.running = undefined;
        });
    };
    this.timer = setInterval(tick, 5 * 60_000);
    this.timer.unref();
    tick();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running?.catch(() => undefined);
  }

  async runOnce() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // The same row lock as booking's attach() prevents deleting a file being bound.
      const { rows } = await client.query<{ id: string }>(
        `select id from patient_files where appointment_id is null and purged_at is null
         and (deleted_at is not null or expires_at <= now()) order by id limit 100 for update skip locked`
      );
      for (const row of rows) {
        await this.storage.remove(row.id);
        await client.query(
          'update patient_files set deleted_at = coalesce(deleted_at, now()), purged_at = now() where id = $1',
          [row.id]
        );
      }
      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
