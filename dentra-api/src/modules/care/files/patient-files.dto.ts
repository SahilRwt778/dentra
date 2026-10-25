import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UploadPatientFileDto {
  @IsUUID('4')
  uploadKey!: string;
}

export class ListPatientFilesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;
}
