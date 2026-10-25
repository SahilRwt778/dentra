import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class ListAdminAppointmentsDto {
  @IsOptional()
  @IsIn(['all', 'today', 'upcoming', 'past'])
  filter?: 'all' | 'today' | 'upcoming' | 'past';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(['booked', 'waiting', 'in_consult', 'completed', 'cancelled'])
  status?: 'booked' | 'waiting' | 'in_consult' | 'completed' | 'cancelled';

  @IsOptional()
  @IsIn(['video', 'clinic'])
  type?: 'video' | 'clinic';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
