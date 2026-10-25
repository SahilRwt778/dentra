import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '@common/decorators/public.decorator';
import { VideoProviderService } from './video-provider.service';
import { VideoService } from './video.service';

@Controller('video')
export class VideoWebhookController {
  constructor(
    private readonly provider: VideoProviderService,
    private readonly video: VideoService
  ) {}

  @Public()
  @Post('webhook')
  @HttpCode(204)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers('authorization') authorization?: string
  ) {
    if (!request.rawBody || !authorization)
      throw new UnauthorizedException('Invalid video webhook.');
    const event = await this.provider.verifyEvent(
      request.rawBody,
      authorization
    );
    await this.video.handleEvent(event);
  }
}
