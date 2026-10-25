import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '@common/decorators/current-user.decorator';
import { Roles } from '@common/decorators/roles.decorator';
import { CareDocumentsService } from './care-documents.service';
import type { CareDocumentKind } from './care-document.types';

@ApiTags('Consultations')
@Controller('appointments')
@Roles('patient', 'dentist')
export class CareDocumentsController {
  constructor(private readonly documents: CareDocumentsService) {}

  @Get(':appointmentId/prescription/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  prescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string
  ) {
    return this.file(user, id, 'prescription');
  }

  @Get(':appointmentId/visit-summary/pdf')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  visitSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('appointmentId', ParseUUIDPipe) id: string
  ) {
    return this.file(user, id, 'visit-summary');
  }

  private async file(
    user: AuthenticatedUser,
    id: string,
    kind: CareDocumentKind
  ) {
    const bytes = await this.documents.download(user, id, kind);
    return new StreamableFile(bytes, {
      type: 'application/pdf',
      length: bytes.length,
      disposition: `attachment; filename="dentra-${kind}-${id}.pdf"`,
    });
  }
}
