import { IsDateString, Matches, ValidateIf } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RescheduleDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;

  @Matches(HHMM, { message: 'time must be HH:MM' })
  time!: string;

  // New clients send both fields to protect against another device moving the visit.
  @ValidateIf((input) => input.expectedDate !== undefined || input.expectedTime !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  expectedDate?: string;

  @ValidateIf((input) => input.expectedDate !== undefined || input.expectedTime !== undefined)
  @Matches(HHMM, { message: 'expectedTime must be HH:MM' })
  expectedTime?: string;
}
