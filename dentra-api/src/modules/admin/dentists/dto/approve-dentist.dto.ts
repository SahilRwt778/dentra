import { IsBoolean, IsOptional } from 'class-validator';

export class ApproveDentistDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
