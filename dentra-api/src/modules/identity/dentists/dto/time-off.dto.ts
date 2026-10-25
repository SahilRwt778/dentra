import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class TimeOffDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  endDate!: string;

  @IsBoolean()
  allDay!: boolean;

  @ValidateIf((input) => input.allDay === false)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  fromTime?: string;

  @ValidateIf((input) => input.allDay === false)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  toTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class CreateTimeOffDto extends TimeOffDto {
  @IsUUID()
  requestId!: string;
}
