import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class DentistSelfUpdateDto {
  @ValidateIf((input) => input.videoWorkingDays !== undefined)
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  videoWorkingDays?: number[];

  @IsOptional()
  @IsBoolean()
  offersVideo?: boolean;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsString()
  councilRegNo?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeVideoPaise?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeClinicPaise?: number;

  @IsOptional()
  @Matches(HHMM, { message: 'videoHoursFrom must be HH:MM' })
  videoHoursFrom?: string;

  @IsOptional()
  @Matches(HHMM, { message: 'videoHoursTo must be HH:MM' })
  videoHoursTo?: string;
}
