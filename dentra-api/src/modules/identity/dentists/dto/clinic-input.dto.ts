import { ArrayMaxSize, ArrayUnique, IsArray, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, ValidateIf } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ClinicInputDto {
  @ValidateIf((input) => input.workingDays !== undefined)
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workingDays?: number[];

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @Matches(HHMM, { message: 'hoursFrom must be HH:MM' })
  hoursFrom!: string;

  @Matches(HHMM, { message: 'hoursTo must be HH:MM' })
  hoursTo!: string;
}
