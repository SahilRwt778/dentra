import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { ListPatientFilesDto, UploadPatientFileDto } from './patient-files.dto';
import { MAX_FILE_BYTES, PatientFilesService } from './patient-files.service';

@ApiTags('Patient Files')
@Controller()
@Roles('patient', 'dentist')
export class PatientFilesController {
  constructor(private readonly files: PatientFilesService) {}

  @Post('patients/me/files')
  @Roles('patient')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 1, parts: 3 },
    })
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadPatientFileDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    if (!file) throw new BadRequestException('Choose a photo or PDF report.');
    return this.files.upload(user.userId, dto.uploadKey, file);
  }

  @Get('patients/me/files')
  @Roles('patient')
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListPatientFilesDto
  ) {
    return this.files.list(user.userId, dto.page, dto.appointmentId);
  }

  @Delete('patients/me/files/:fileId')
  @Roles('patient')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileId', ParseUUIDPipe) id: string
  ) {
    return this.files.remove(user.userId, id);
  }

  @Get('appointments/:appointmentId/attachments')
  @Header('Cache-Control', 'no-store')
  appointmentFiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string
  ) {
    return this.files.appointmentFiles(user, id);
  }

  @Get('patient-files/:fileId/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "sandbox; default-src 'none'")
  async content(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fileId', ParseUUIDPipe) id: string
  ) {
    const { file, bytes } = await this.files.content(user, id);
    const extension =
      file.mimeType === 'application/pdf'
        ? 'pdf'
        : file.mimeType === 'image/png'
        ? 'png'
        : 'jpg';
    const name = file.name.toLowerCase().endsWith(`.${extension}`) ? file.name : `${file.name}.${extension}`;
    return new StreamableFile(bytes, {
      type: file.mimeType,
      length: bytes.length,
      disposition: `attachment; filename="attachment.${extension}"; filename*=UTF-8''${encodeURIComponent(
        name
      ).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
    });
  }
}
