import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsOptional, Length, Matches, Max, Min } from 'class-validator';

export class TreatmentPlanItemInput {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @Length(1, 200)
  procedure!: string;

  @IsArray()
  @ArrayMaxSize(32)
  @ArrayUnique()
  @Matches(/^[1-4][1-8]$/, { each: true, message: 'teeth must use permanent FDI notation, e.g. "36"' })
  teeth!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000000000)
  estimatedCostPaise?: number | null;
}
