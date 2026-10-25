import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';

export class AdminCreateDentistDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @Matches(/^\+[1-9][0-9]{7,14}$/, { message: 'mobile must be E.164, e.g. +919820010482' })
  mobile!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  qualification?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  councilRegNo?: string;

  @IsString()
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

  @IsOptional()
  @IsBoolean()
  overrideVerify?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  overrideReason?: string;
}
