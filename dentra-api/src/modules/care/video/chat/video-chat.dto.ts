import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ChatPageDto {
  @IsOptional() @Matches(/^\d{1,19}$/) after?: string;
  @IsOptional() @Matches(/^\d{1,19}$/) before?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}
export class SendChatDto {
  @IsUUID('4') requestId!: string;
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
}
