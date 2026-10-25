import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AppConfig } from '@config/configuration';
import {
  MAX_PRIVATE_FILE_BYTES,
  type PrivateFileType,
} from './private-file-type';

/** Server-only access. Callers authorize the user before requesting any object. */
@Injectable()
export class SupabaseFileStorage implements OnApplicationBootstrap {
  private readonly client?: SupabaseClient;
  private readonly bucketName: string;
  private privateBucket?: Promise<void>;

  constructor(@Inject(ConfigService) config: ConfigService<AppConfig>) {
    const settings = config.get('storage', { infer: true });
    this.bucketName = settings?.bucket ?? 'dentra-private';
    if (settings?.provider === 'supabase') {
      this.client = createClient(settings.url, settings.secretKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (input, options) =>
            fetch(input, {
              ...options,
              signal: options?.signal
                ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
                : AbortSignal.timeout(15_000),
            }),
        },
      });
    }
  }
  isEnabled() {
    return !!this.client;
  }
  async onApplicationBootstrap() {
    if (this.client) await this.bucket();
  }

  private async bucket() {
    if (!this.client) throw this.unavailable();
    this.privateBucket ??= this.verifyBucket().catch((error) => {
      this.privateBucket = undefined;
      throw error;
    });
    await this.privateBucket;
    return this.client.storage.from(this.bucketName);
  }
  private async verifyBucket() {
    try {
      const { data, error } = await this.client!.storage.getBucket(
        this.bucketName
      );
      if (error || !data) throw this.unavailable();
      if (data.public !== false)
        throw new ServiceUnavailableException(
          'The Dentra storage bucket must be private.'
        );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw this.unavailable();
    }
  }
  private validateKey(key: string) {
    if (
      !/^[a-z0-9][a-z0-9/._-]*$/i.test(key) ||
      key.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error('Invalid private storage key.');
  }
  private unavailable() {
    return new ServiceUnavailableException(
      'Private file storage is unavailable. Check the server Supabase settings and bucket.'
    );
  }
  private isMissing(error: {
    status?: number;
    code?: string;
    message?: string;
  }) {
    return (
      error.status === 404 ||
      error.code === 'NoSuchKey' ||
      error.code === 'not_found' ||
      (error.status === 400 && error.message === 'Object not found')
    );
  }

  async save(key: string, bytes: Buffer, contentType: PrivateFileType) {
    this.validateKey(key);
    const bucket = await this.bucket();
    try {
      const { error } = await bucket.upload(key, bytes, {
        contentType,
        cacheControl: '0',
        upsert: false,
      });
      if (error) throw this.unavailable();
    } catch {
      // Never return or log provider error bodies: they can contain private paths or request details.
      throw this.unavailable();
    }
  }
  async read(key: string) {
    this.validateKey(key);
    const bucket = await this.bucket();
    try {
      const { data, error } = await bucket.download(key);
      if (error && this.isMissing(error))
        throw Object.assign(new Error('The stored file is unavailable.'), {
          code: 'ENOENT',
        });
      if (error || !data || data.size > MAX_PRIVATE_FILE_BYTES)
        throw this.unavailable();
      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
      throw this.unavailable();
    }
  }
  async remove(key: string) {
    this.validateKey(key);
    const bucket = await this.bucket();
    try {
      const { error } = await bucket.remove([key]);
      if (error && !this.isMissing(error)) throw this.unavailable();
    } catch {
      throw this.unavailable();
    }
  }
}
