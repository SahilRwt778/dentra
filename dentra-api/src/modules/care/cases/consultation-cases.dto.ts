import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  Min,
  Max,
} from 'class-validator';

export type ConversationFilter = 'all' | 'open' | 'closed';
export class ConsultationCasesQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @IsIn(['all', 'open', 'closed']) filter?: ConversationFilter;
}

export class FollowUpBookingDto {
  @IsIn(['video', 'clinic']) type!: 'video' | 'clinic';
  @IsOptional() @IsUUID() clinicId?: string;
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) time!: string;
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentIds?: string[];
  @IsString() @MinLength(1) @MaxLength(160) idempotencyKey!: string;
}

export class ReadChatDto {
  @IsString() @Matches(/^\d{1,19}$/) sequence!: string;
}
