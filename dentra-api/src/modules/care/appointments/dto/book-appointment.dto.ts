import {
  IsArray,
  ArrayMaxSize,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BookAppointmentDto {
  @IsUUID()
  dentistId!: string;

  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @IsIn(['video', 'clinic'])
  type!: 'video' | 'clinic';

  @IsDateString()
  date!: string;

  @Matches(HHMM, { message: 'time must be HH:MM' })
  time!: string;

  @IsString()
  @MinLength(1)
  concern!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  concerns?: string[];

  @IsOptional()
  @IsString()
  symptomArea?: string;

  @IsOptional()
  @IsString()
  symptomSince?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScore?: number;

  @IsOptional()
  @IsBoolean()
  swelling?: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];

  @IsIn(['upi', 'card', 'netbanking', 'pay_at_clinic'])
  paymentMethod!: 'upi' | 'card' | 'netbanking' | 'pay_at_clinic';

  @IsString()
  @MinLength(1)
  idempotencyKey!: string;
}
