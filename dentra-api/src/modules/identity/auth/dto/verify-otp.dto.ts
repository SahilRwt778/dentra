import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsUUID()
  otpId!: string;

  @Matches(/^[0-9]{4}$/, { message: 'code must be exactly 4 digits' })
  code!: string;

  @IsString()
  deviceId!: string;
}
