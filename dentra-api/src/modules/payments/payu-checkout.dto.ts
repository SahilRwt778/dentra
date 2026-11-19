import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PayuHashDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  hashName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16000)
  hashString!: string;

  @IsOptional()
  @IsIn(['V1', 'V2'])
  hashType?: 'V1' | 'V2';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  postSalt?: string;
}
