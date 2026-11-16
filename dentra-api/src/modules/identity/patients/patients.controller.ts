import { FileInterceptor } from '@nestjs/platform-express';
import { ProfilePhotoFormInterceptor } from '../profile-photos/profile-photo-form.interceptor';
import { MAX_PROFILE_PHOTO_BYTES } from '../profile-photos/profile-photos.service';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { PatientsService } from './patients.service';
import { PatientRegistrationDto } from './dto/patient-registration.dto';
import { PatientUpdateDto } from './dto/patient-update.dto';

/** Maps to the Patients tag in ../../../openapi.yaml. Patient-only — a dentist or admin token gets 403. */
@ApiTags('Patients')
@Controller('patients')
@Roles('patient')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post('register')
  @UseInterceptors(FileInterceptor('profilePhoto', { limits: { fileSize: MAX_PROFILE_PHOTO_BYTES, files: 1, fields: 1 } }), ProfilePhotoFormInterceptor)
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatientRegistrationDto, @UploadedFile() photo?: Express.Multer.File) {
    return this.patients.register(user.userId, dto, photo);
  }

  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.patients.findMe(user.userId);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: PatientUpdateDto) {
    return this.patients.update(user.userId, dto);
  }

  @Get('me/chart')
  @HttpCode(HttpStatus.OK)
  chart(@CurrentUser() user: AuthenticatedUser) {
    return this.patients.getChart(user.userId);
  }
}
