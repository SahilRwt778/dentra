import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PayoutPageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class ListPayoutBatchesDto extends PayoutPageDto {
  @IsOptional()
  @IsIn(['pending', 'processing', 'paid', 'failed', 'cancelled'])
  status?: string;
}
export class AdminPayoutBatchesDto extends ListPayoutBatchesDto {
  @IsOptional()
  @IsUUID()
  dentistId?: string;
}
export class PayoutDentistsDto extends PayoutPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
}
export class EligiblePayoutsDto extends PayoutPageDto {
  @IsUUID()
  dentistId!: string;
}
export class CreatePayoutBatchDto {
  @IsUUID() requestId!: string;
  @IsUUID() dentistId!: string;
  @IsUUID() accountApprovalId!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  transactionIds!: string[];
  @IsInt()
  @Min(0)
  @Max(10000)
  feeBps!: number;
}
export class UpdatePayoutBatchDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) version!: number;
  @IsIn(['processing', 'paid', 'failed', 'cancelled'])
  action!: 'processing' | 'paid' | 'failed' | 'cancelled';
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9._/-]{2,99}$/)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  reference?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  paidOn?: string;
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
  @IsOptional()
  @IsBoolean()
  acknowledgeChanges?: boolean;
}
