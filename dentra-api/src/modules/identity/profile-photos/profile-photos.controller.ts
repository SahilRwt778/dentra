import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Pool } from 'pg';
import type { Response } from 'express';
import { PG_POOL } from '@database/database.module';
import { Public } from '@common/decorators/public.decorator';
import { ProfilePhotosService } from './profile-photos.service';

@Controller('profile-photos')
export class ProfilePhotosController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly photos: ProfilePhotosService,
  ) {}

  /** The expiring signature grants access to this image only, never to an account. */
  @Public()
  @Get(':role/:userId')
  async read(
    @Param('role') role: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (role !== 'patient' && role !== 'dentist') throw new NotFoundException();
    const table = role === 'patient' ? 'patients' : 'dentists';
    const { rows } = await this.pool.query(
      `select p.profile_photo_url from ${table} p join users u on u.id = p.user_id
       where p.user_id = $1 and u.status = 'active'`,
      [userId],
    );
    const photo = await this.photos.read(
      role,
      userId,
      rows[0]?.profile_photo_url,
      expires,
      signature,
    );
    response.set({
      'Content-Type': photo.mimeType,
      'Content-Length': String(photo.bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    });
    return new StreamableFile(photo.bytes);
  }
}
