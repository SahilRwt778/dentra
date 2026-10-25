import { IsString, MinLength } from 'class-validator';

export class RejectDentistDto {
  @IsString()
  @MinLength(1)
  reason!: string;
}
