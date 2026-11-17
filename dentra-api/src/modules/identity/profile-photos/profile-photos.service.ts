import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SupabaseFileStorage } from '@common/storage/supabase-file-storage';
import {
  detectPrivateFileType,
  privateFileExtension,
} from '@common/storage/private-file-type';

export type PhotoRole = 'patient' | 'dentist';
export type ProfilePhotoUpload = Pick<Express.Multer.File, 'buffer'>;
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

/** Only image references live in profile tables; bytes stay in private storage. */
@Injectable()
export class ProfilePhotosService {
  private readonly logger = new Logger(ProfilePhotosService.name);
  constructor(
    private readonly config: ConfigService,
    private readonly cloud: SupabaseFileStorage,
  ) {}

  async save(role: PhotoRole, userId: string, file: ProfilePhotoUpload) {
    if (!file.buffer.length || file.buffer.length > MAX_PROFILE_PHOTO_BYTES)
      throw new BadRequestException(
        'Profile photos must be between 1 byte and 5 MB.',
      );
    const type = detectPrivateFileType(file.buffer);
    if (type === 'application/pdf')
      throw new BadRequestException('Choose a JPEG or PNG profile photo.');
    const key = `profile-photos/${role}/${userId}/${randomUUID()}.${privateFileExtension(
      type,
    )}`;
    this.validateKey(role, userId, key);
    if (this.cloud.isEnabled()) await this.cloud.save(key, file.buffer, type);
    else {
      const directory = join(this.directory(), role, userId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(this.path(key), file.buffer, { flag: 'wx', mode: 0o600 });
    }
    return key;
  }

  url(role: PhotoRole, userId: string, reference?: string | null) {
    if (!reference) return null;
    // Ignore legacy/unmanaged URLs rather than exposing arbitrary external images.
    try {
      this.validateKey(role, userId, reference);
    } catch {
      return null;
    }
    // Keep links stable during inbox polling so avatars can use the image cache.
    // The signature still changes immediately when the stored photo changes.
    const windowSeconds = 300;
    const expires =
      Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds + 3600;
    return `/profile-photos/${role}/${userId}?expires=${expires}&signature=${this.signature(
      reference,
      expires,
    )}`;
  }

  async read(
    role: PhotoRole,
    userId: string,
    reference: string | null,
    expires: string,
    signature: string,
  ) {
    const deadline = Number(expires);
    if (
      typeof expires !== 'string' ||
      typeof signature !== 'string' ||
      !reference ||
      !Number.isSafeInteger(deadline) ||
      deadline < Date.now() / 1000 ||
      deadline > Date.now() / 1000 + 3601 ||
      !/^[a-f0-9]{64}$/.test(signature ?? '')
    )
      throw new NotFoundException(
        'This profile photo link is unavailable or expired.',
      );
    this.validateKey(role, userId, reference);
    const expected = this.signature(reference, deadline);
    if (
      !timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      )
    )
      throw new NotFoundException(
        'This profile photo link is unavailable or expired.',
      );
    try {
      const bytes = this.cloud.isEnabled()
        ? await this.cloud.read(reference)
        : await readFile(this.path(reference));
      return { bytes, mimeType: detectPrivateFileType(bytes) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException('Profile photo unavailable.');
      throw error;
    }
  }

  async removeUnused(
    role: PhotoRole,
    userId: string,
    reference?: string | null,
  ) {
    if (!reference) return;
    try {
      this.validateKey(role, userId, reference);
      if (this.cloud.isEnabled()) await this.cloud.remove(reference);
      else await unlink(this.path(reference));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        this.logger.warn('An unused profile photo could not be removed.');
    }
  }
  private signature(reference: string, expires: number) {
    return createHmac(
      'sha256',
      this.config.getOrThrow<string>('jwt.accessSecret'),
    )
      .update(`dentra-profile-photo\n${reference}\n${expires}`)
      .digest('hex');
  }
  private validateKey(role: PhotoRole, userId: string, reference: string) {
    if (
      !/^[0-9a-f-]{36}$/i.test(userId) ||
      !new RegExp(
        `^profile-photos/${role}/${userId}/[0-9a-f-]{36}\\.(jpg|png)$`,
        'i',
      ).test(reference)
    )
      throw new NotFoundException('Profile photo unavailable.');
  }
  private directory() {
    return join(
      this.config.getOrThrow<string>('patientFilesDirectory'),
      'profile-photos',
    );
  }
  private path(reference: string) {
    return join(this.directory(), reference.slice('profile-photos/'.length));
  }
}
