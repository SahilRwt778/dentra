import { IsIn, IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @Matches(/^\+[1-9][0-9]{7,14}$/, { message: 'mobile must be E.164, e.g. +919820010482' })
  mobile!: string;

  @IsString()
  @IsIn(['patient', 'dentist'])
  purpose!: 'patient' | 'dentist';
}
