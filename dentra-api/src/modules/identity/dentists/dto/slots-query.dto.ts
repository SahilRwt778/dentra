import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class SlotsQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  date!: string;

  @IsIn(['clinic', 'video'])
  type!: 'clinic' | 'video';

  @IsOptional()
  @IsUUID()
  clinicId?: string;
}
