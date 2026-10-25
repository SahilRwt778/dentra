import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { TreatmentPlanItemInput } from './treatment-plan-item.dto';

const TOOTH_STATUSES = ['healthy', 'caries', 'filled', 'crown', 'rct', 'missing', 'extract'];

export class ChartEntryInput {
  @Matches(/^[1-4][1-8]$/, { message: 'toothNumber must be FDI notation, e.g. "36"' })
  toothNumber!: string;

  @IsIn(TOOTH_STATUSES)
  status!: string;
}

export class PrescriptionItemInput {
  @IsString()
  medicineName!: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsString()
  dose!: string;

  @IsString()
  frequency!: string;

  @IsString()
  duration!: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class ConsultationDraftDto {
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  findings?: string;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  treatmentDone?: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TreatmentPlanItemInput)
  planItems?: TreatmentPlanItemInput[];

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'followUpDate must be a calendar date (YYYY-MM-DD).',
  })
  @IsDateString({ strict: true })
  followUpDate?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChartEntryInput)
  chart?: ChartEntryInput[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemInput)
  prescriptionItems?: PrescriptionItemInput[];
}
