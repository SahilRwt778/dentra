import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SupabaseFileStorage } from '@common/storage/supabase-file-storage';
import {
  detectPrivateFileType,
  privateFileExtension,
} from '@common/storage/private-file-type';
import type { KycDocType } from './dto/kyc-doc-type';

/** Internal references keep the existing database/API contract; they are never public URLs. */
@Injectable()
export class DentistDocumentsStorage {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly cloud: SupabaseFileStorage
  ) {}

  async save(dentistId: string, docType: KycDocType, bytes: Buffer) {
    if (!/^[0-9a-f-]{36}$/i.test(dentistId))
      throw new Error('Invalid dentist identifier.');
    const type = detectPrivateFileType(bytes);
    // Immutable object names preserve the previous version until the database commits.
    const name = `${docType}-${randomUUID()}.${privateFileExtension(type)}`;
    const reference = `/uploads/dentists/${dentistId}/${name}`;
    if (this.cloud.isEnabled())
      await this.cloud.save(this.key(dentistId, reference), bytes, type);
    else {
      const path = this.path(dentistId, reference);
      await mkdir(join(this.directory(), dentistId), {
        recursive: true,
        mode: 0o700,
      });
      await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
    }
    return reference;
  }

  async read(dentistId: string, reference: string) {
    try {
      const bytes = this.cloud.isEnabled()
        ? await this.cloud.read(this.key(dentistId, reference))
        : await readFile(this.path(dentistId, reference));
      return {
        bytes,
        mimeType: detectPrivateFileType(bytes),
        filename: reference.split('/').pop()!,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException('The stored document is unavailable.');
      throw error;
    }
  }

  async remove(dentistId: string, reference: string) {
    if (this.cloud.isEnabled())
      return this.cloud.remove(this.key(dentistId, reference));
    try {
      await unlink(this.path(dentistId, reference));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  private directory() {
    return this.config.getOrThrow<string>('dentistFilesDirectory');
  }
  private key(dentistId: string, reference: string) {
    const prefix = `/uploads/dentists/${dentistId}/`;
    const name = reference.slice(prefix.length);
    if (
      !/^[0-9a-f-]{36}$/i.test(dentistId) ||
      !reference.startsWith(prefix) ||
      !/^[a-z0-9][a-z0-9._-]*$/i.test(name) ||
      name.includes('..')
    )
      throw new Error('Invalid private document reference.');
    return `dentists/${dentistId}/${name}`;
  }
  private path(dentistId: string, reference: string) {
    const key = this.key(dentistId, reference);
    return join(this.directory(), key.slice('dentists/'.length));
  }
}
