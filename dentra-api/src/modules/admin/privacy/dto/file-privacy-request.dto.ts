import { IsIn } from 'class-validator';

export class FilePrivacyRequestDto {
  @IsIn(['export', 'erase'])
  type!: 'export' | 'erase';
}
