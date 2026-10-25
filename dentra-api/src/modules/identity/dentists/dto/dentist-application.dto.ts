import { Equals, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class DentistApplicationDto {
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  qualification!: string;

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  specialization!: string;

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  councilRegNo!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @MinLength(1)
  primaryClinicName!: string;

  @IsOptional()
  @IsBoolean()
  offersVideo?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeVideoPaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeClinicPaise?: number;

  @IsBoolean()
  @Equals(true)
  termsConsent!: boolean;

  @IsBoolean()
  @Equals(true)
  telemedicineConsent!: boolean;
}
