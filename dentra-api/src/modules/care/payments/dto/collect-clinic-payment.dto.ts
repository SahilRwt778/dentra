import { IsIn, IsInt, IsUUID, Max, Min } from 'class-validator';

export class CollectClinicPaymentDto {
  @IsUUID()
  requestId!: string;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  amountPaise!: number;

  @IsIn(['cash', 'upi', 'card'])
  method!: 'cash' | 'upi' | 'card';
}
