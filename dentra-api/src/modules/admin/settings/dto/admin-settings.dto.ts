import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const phone = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().replace(/[\s()-]/g, '');
  if (!cleaned) return null;
  return /^[6-9]\d{9}$/.test(cleaned) ? `+91${cleaned}` : cleaned;
};

export class UpdateAdminProfileDto {
  @IsInt()
  @Min(0)
  version!: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(email)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Transform(phone)
  @IsString()
  @Matches(/^\+[1-9][0-9]{7,14}$/, { message: 'phone must be a valid mobile number including country code.' })
  phone?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword?: string;
}

export class UpdatePlatformSettingsDto {
  @IsInt()
  @Min(1)
  version!: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  region?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(email)
  @IsEmail()
  @MaxLength(254)
  supportEmail?: string;
}
