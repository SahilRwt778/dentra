import { IsBoolean, IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class PatientRegistrationDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsBoolean()
  termsConsent!: boolean;

  @IsBoolean()
  telemedicineConsent!: boolean;

  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianRelationship?: string;

  @IsOptional()
  @IsString()
  guardianMobile?: string;

  @IsOptional()
  @IsBoolean()
  guardianConsent?: boolean;
}
