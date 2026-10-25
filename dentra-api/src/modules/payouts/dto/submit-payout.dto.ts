import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class SubmitPayoutDto {
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(120)
  bankAccountHolder!: string;

  @IsString()
  @Transform(trim)
  @Matches(/^\d{6,20}$/, {
    message: 'Account number must contain 6–20 digits.',
  })
  bankAccountNo!: string;

  @IsString()
  @Transform(trim)
  @Matches(/^\d{6,20}$/)
  confirmAccountNo!: string;

  @IsString()
  @Transform(uppercase)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'Enter a valid 11-character IFSC.',
  })
  bankIfsc!: string;

  @IsString()
  @Transform(uppercase)
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'Enter a valid PAN.' })
  pan!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, {
    message: 'Enter a valid GSTIN or leave it blank.',
  })
  gstin?: string | null;

  // The last request seen by the form; prevents submission from a stale tab.
  @IsOptional()
  @IsUUID()
  previousRequestId?: string | null;
}

export class RejectPayoutDto {
  @IsString()
  @Transform(trim)
  @Length(3, 1000)
  reason!: string;
}
