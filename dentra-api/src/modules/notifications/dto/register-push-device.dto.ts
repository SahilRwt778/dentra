import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterPushDeviceDto {
  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  @Matches(/^\S+$/)
  token!: string;

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}
