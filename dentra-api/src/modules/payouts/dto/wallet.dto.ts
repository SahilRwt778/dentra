import { Transform } from 'class-transformer';
import {
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
import { PayoutPageDto } from './payout-batch.dto';

export class WalletSettingsDto {
  @IsInt() @Min(1) version!: number;
  @IsInt() @Min(0) @Max(9999) feeBps!: number;
  @IsInt() @Min(1) @Max(2147483647) minimumWithdrawalPaise!: number;
  @IsOptional() @IsBoolean() applyToUnpriced = false;
}
export class RequestWithdrawalDto {
  @IsUUID() requestId!: string;
  @IsUUID() accountApprovalId!: string;
  @IsInt() @Min(1) @Max(2147483647) amountPaise!: number;
}
export class WithdrawalListDto extends PayoutPageDto {
  @IsOptional()
  @IsIn([
    'requested',
    'approved',
    'processing',
    'paid',
    'rejected',
    'failed',
    'cancelled',
  ])
  status?: string;
}
export class AdminWithdrawalListDto extends WithdrawalListDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;
}
export class WithdrawalActionDto {
  @IsUUID() requestId!: string;
  @IsInt() @Min(1) version!: number;
  @IsIn(['approved', 'rejected', 'processing', 'paid', 'failed', 'cancelled'])
  action!:
    | 'approved'
    | 'rejected'
    | 'processing'
    | 'paid'
    | 'failed'
    | 'cancelled';
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  note?: string;
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
  @IsOptional() @IsBoolean() acknowledgeChanges?: boolean;
}
