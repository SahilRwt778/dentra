import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { MAX_FILE_BYTES } from '../../files/patient-files.service';
import { ChatPageDto, SendChatDto } from './video-chat.dto';
import { VideoChatService } from './video-chat.service';

@Controller('appointments/:appointmentId/video/chat')
@Roles('patient', 'dentist')
export class VideoChatController {
  constructor(private readonly chat: VideoChatService) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string,
    @Query() page: ChatPageDto
  ) {
    return this.chat.list(user, id, page);
  }
  @Post()
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2, parts: 4 },
    })
  )
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string,
    @Body() dto: SendChatDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.chat.send(user, id, dto, file);
  }
  @Get(':messageId/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "sandbox; default-src 'none'")
  async content(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string
  ) {
    const { file, bytes } = await this.chat.content(user, id, messageId);
    if (!file.mime_type)
      throw new BadRequestException('This message has no attachment.');
    const extension =
      file.mime_type === 'application/pdf'
        ? 'pdf'
        : file.mime_type === 'image/png'
        ? 'png'
        : 'jpg';
    const name = encodeURIComponent(
      file.file_name ?? `Attachment.${extension}`
    ).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
    return new StreamableFile(bytes, {
      type: file.mime_type,
      length: bytes.length,
      disposition: `attachment; filename="attachment.${extension}"; filename*=UTF-8''${name}`,
    });
  }
}
