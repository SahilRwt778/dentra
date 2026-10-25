import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Private local storage, never mounted as a public static directory. */
@Injectable()
export class PatientFilesStorage {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  private path(id: string) {
    // IDs come only from validated UUIDs or rows selected from PostgreSQL.
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new Error('Invalid storage identifier.');
    return join(this.config.getOrThrow<string>('patientFilesDirectory'), id);
  }

  async save(id: string, bytes: Buffer) {
    await mkdir(this.config.getOrThrow<string>('patientFilesDirectory'), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(this.path(id), bytes, { flag: 'wx', mode: 0o600 });
  }

  read(id: string) {
    return readFile(this.path(id));
  }

  async remove(id: string) {
    try {
      await unlink(this.path(id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
