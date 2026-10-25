import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { AllowUnverifiedDentist } from '@common/decorators/allow-unverified-dentist.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { DentistsService } from './dentists.service';
import { DentistApplicationDto } from './dto/dentist-application.dto';
import { KYC_DOC_TYPES, type KycDocType } from './dto/kyc-doc-type';

/** Maps to the Dentist Onboarding tag in ../../../openapi.yaml. */
@ApiTags('Dentist Onboarding')
@Controller('dentists/applications')
@AllowUnverifiedDentist()
export class ApplicationsController {
  constructor(private readonly dentists: DentistsService) {}

  @Roles('dentist')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DentistApplicationDto
  ) {
    return this.dentists.createApplication(user.userId, dto);
  }

  @Roles('dentist')
  @Patch('me')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DentistApplicationDto
  ) {
    return this.dentists.updateApplication(user.userId, dto);
  }

  @Roles('dentist')
  @Post('me/submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.dentists.submitApplication(user.userId);
  }

  @Roles('dentist')
  @Post(':dentistId/documents')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dentistId') dentistId: string,
    @Body('docType') docType: string,
    @UploadedFile() file?: Express.Multer.File
  ) {
    // The path carries dentistId for REST consistency with the rest of
    // the API, but self-serve upload only ever targets your own
    // application — enforced here, not left to the client to get right.
    if (dentistId !== user.userId) {
      throw new ForbiddenException(
        "Can't upload documents for another dentist's application."
      );
    }
    if (!file) throw new BadRequestException('file is required.');
    if (!KYC_DOC_TYPES.includes(docType as KycDocType)) {
      throw new BadRequestException(
        `docType must be one of: ${KYC_DOC_TYPES.join(', ')}`
      );
    }
    return this.dentists.uploadDocument(dentistId, docType as KycDocType, file);
  }

  @Roles('dentist', 'admin')
  @Get(':dentistId/documents/:documentId')
  async downloadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('dentistId') dentistId: string,
    @Param('documentId') documentId: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    // KYC documents (a government ID, a selfie) — never a static,
    // guessable-URL asset. The owning dentist or an admin reviewing the
    // application can read it; nobody else, including other dentists.
    if (user.role === 'dentist' && dentistId !== user.userId) {
      throw new ForbiddenException("Can't view another dentist's documents.");
    }
    const file = await this.dentists.getDocumentFile(dentistId, documentId);
    if (!file) throw new NotFoundException('No such document.');

    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Content-Disposition': `inline; filename="${file.filename}"`,
    });
    return new StreamableFile(file.bytes);
  }
}
