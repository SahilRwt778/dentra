import { IsBoolean, IsOptional, IsUUID, Matches } from 'class-validator';

export class SignPrescriptionDto {
  @IsUUID()
  otpId!: string;

  @Matches(/^[0-9]{4}$/, { message: 'confirmationCode must be exactly 4 digits' })
  confirmationCode!: string;

  @IsOptional()
  @IsBoolean()
  allergyOverrideAck?: boolean;
}
