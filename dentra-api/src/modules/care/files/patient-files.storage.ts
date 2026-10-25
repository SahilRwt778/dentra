import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SupabaseFileStorage } from '@common/storage/supabase-file-storage';
import { detectPrivateFileType } from '@common/storage/private-file-type';

/** Stable patient/chat object IDs, backed by local development files or private Supabase storage. */
@Injectable()
export class PatientFilesStorage {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly cloud: SupabaseFileStorage
  ) {}

  private path(id: string) {
    // IDs come only from validated UUIDs or rows selected from PostgreSQL.
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Error('Invalid storage identifier.');
    return join(this.config.getOrThrow<string>('patientFilesDirectory'), id);
  }

  async save(id: string, bytes: Buffer) {
    this.path(id);
    if (this.cloud.isEnabled())
      return this.cloud.save(
        `patients/${id}`,
        bytes,
        detectPrivateFileType(bytes)
      );
    await mkdir(this.config.getOrThrow<string>('patientFilesDirectory'), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(this.path(id), bytes, { flag: 'wx', mode: 0o600 });
  }

  read(id: string) {
    const path = this.path(id);
    return this.cloud.isEnabled()
      ? this.cloud.read(`patients/${id}`)
      : readFile(path);
  }

  async remove(id: string) {
    const path = this.path(id);
    if (this.cloud.isEnabled()) return this.cloud.remove(`patients/${id}`);
    try {
      await unlink(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
