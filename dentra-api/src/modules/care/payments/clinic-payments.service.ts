import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '@database/database.module';
import type { AuthenticatedUser } from '@common/decorators/current-user.decorator';
import { AuditService } from '@modules/admin/audit/audit.service';
import { AppointmentsService } from '../appointments/appointments.service';
import type { CollectClinicPaymentDto } from './dto/collect-clinic-payment.dto';

type TransactionRow = {
  id: string;
  status: string;
  amount_paise: number;
  method: string;
  gateway_ref: string | null;
  gateway_payment_ref: string | null;
};
type CollectionRow = { id: string; amount_paise: number; method: string };

@Injectable()
export class ClinicPaymentsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly appointments: AppointmentsService,
    private readonly audit: AuditService,
  ) {}

  async collect(
    user: AuthenticatedUser,
    appointmentId: string,
    dto: CollectClinicPaymentDto,
  ) {
    if (user.role !== 'dentist')
      throw new ForbiddenException(
        'Only the treating dentist can record clinic payments.',
      );
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Cancellation and online payment processing use this same lock order.
      const appointment = await this.appointments.assertOwned(
        user,
        appointmentId,
        client,
        true,
      );
      const { rows: transactions } = await client.query<TransactionRow>(
        'select id, status, amount_paise, method, gateway_ref, gateway_payment_ref from transactions where appointment_id = $1 for update',
        [appointmentId],
      );
      if (!transactions.length)
        throw new NotFoundException(
          'No payment is attached to this appointment.',
        );
      if (transactions.length !== 1)
        throw new ConflictException(
          'This payment needs review. Please contact support.',
        );
      const transaction = transactions[0];
      const { rows: collections } = await client.query<CollectionRow>(
        'select id, amount_paise, method from clinic_payment_collections where transaction_id = $1',
        [transaction.id],
      );
      const existing = collections[0];
      if (existing) {
        if (
          existing.id !== dto.requestId ||
          existing.amount_paise !== dto.amountPaise ||
          existing.method !== dto.method
        ) {
          throw new ConflictException(
            'Payment has already been recorded. Refresh to view its receipt.',
          );
        }
        // A lost response can be retried, including after a later cancellation.
      } else {
        if (
          appointment.type !== 'clinic' ||
          transaction.method !== 'pay_at_clinic' ||
          transaction.gateway_ref ||
          transaction.gateway_payment_ref
        ) {
          throw new ConflictException(
            'Only pay-at-clinic appointments can be marked paid here.',
          );
        }
        if (
          appointment.status === 'cancelled' ||
          transaction.status !== 'due_at_clinic'
        ) {
          throw new ConflictException(
            'This appointment is no longer awaiting a clinic payment. Refresh its status.',
          );
        }
        if (dto.amountPaise !== transaction.amount_paise) {
          throw new ConflictException(
            'Record the full consultation fee shown on the appointment. Refresh if the amount has changed.',
          );
        }
        await client.query(
          `insert into clinic_payment_collections (id, transaction_id, amount_paise, method, collected_by)
           values ($1,$2,$3,$4,$5)`,
          [
            dto.requestId,
            transaction.id,
            dto.amountPaise,
            dto.method,
            user.userId,
          ],
        );
        await client.query(
          "update transactions set status = 'paid', updated_at = now() where id = $1",
          [transaction.id],
        );
        await this.audit.log(
          {
            actorUserId: user.userId,
            action: 'clinic_payment_recorded',
            entityType: 'appointment',
            entityId: appointmentId,
            detail: 'Full consultation fee recorded as received at the clinic.',
            beforeState: {
              status: transaction.status,
              amountPaise: transaction.amount_paise,
            },
            afterState: {
              status: 'paid',
              collectionId: dto.requestId,
              amountPaise: dto.amountPaise,
              method: dto.method,
            },
          },
          client,
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'Payment is already recorded or this request ID is already in use. Refresh and try again.',
        );
      }
      throw error;
    } finally {
      client.release();
    }
    return this.appointments.get(user, appointmentId);
  }
}
