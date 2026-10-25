import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '@database/database.module';
import { AuditService } from '@modules/admin/audit/audit.service';
import type { SubmitPayoutDto } from './dto/submit-payout.dto';
import type { ListPayoutRequestsDto } from './dto/list-payout-requests.dto';

type PayoutFields = {
  bank_account_holder: string | null;
  bank_account_no: string | null;
  bank_ifsc: string | null;
  pan: string | null;
  gstin: string | null;
};
type RequestRow = PayoutFields & {
  id: string;
  dentist_id: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: Date | string;
  reviewed_at: Date | string | null;
  rejection_reason: string | null;
};

function details(row: PayoutFields) {
  return {
    bankAccountHolder: row.bank_account_holder,
    bankAccountNo: row.bank_account_no,
    bankIfsc: row.bank_ifsc,
    pan: row.pan,
    gstin: row.gstin,
  };
}
function requestResponse(row: RequestRow) {
  return {
    ...details(row),
    id: row.id,
    dentistId: row.dentist_id,
    status: row.status,
    submittedAt: new Date(row.submitted_at).toISOString(),
    reviewedAt: row.reviewed_at
      ? new Date(row.reviewed_at).toISOString()
      : null,
    rejectionReason: row.rejection_reason,
  };
}

@Injectable()
export class PayoutsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly audit: AuditService,
  ) {}

  async profile(dentistId: string) {
    // One statement returns the approved account and latest proposal from the same snapshot.
    const { rows } = await this.pool.query<
      PayoutFields & { latest_request: RequestRow | null }
    >(
      `select d.bank_account_holder, d.bank_account_no, d.bank_ifsc, d.pan, d.gstin,
              (select row_to_json(r) from dentist_payout_requests r where r.dentist_id = d.user_id
               order by r.submitted_at desc, r.id desc limit 1) as latest_request
       from dentists d where d.user_id = $1`,
      [dentistId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('No such dentist.');
    return {
      approved: row.bank_account_no ? details(row) : null,
      request: row.latest_request ? requestResponse(row.latest_request) : null,
    };
  }

  async submit(dentistId: string, input: SubmitPayoutDto) {
    if (input.bankAccountNo !== input.confirmAccountNo) {
      throw new BadRequestException('Account numbers do not match.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.lockDentist(client, dentistId, true);
      const latest = await client.query<RequestRow>(
        'select * from dentist_payout_requests where dentist_id = $1 order by submitted_at desc, id desc limit 1',
        [dentistId],
      );
      const previous = latest.rows[0];
      if (previous?.status === 'pending')
        throw new ConflictException(
          'A payout request is already awaiting admin review.',
        );
      if ((previous?.id ?? null) !== (input.previousRequestId ?? null)) {
        throw new ConflictException(
          'Payout details have changed. Refresh before submitting again.',
        );
      }
      const { rows } = await client.query<RequestRow>(
        `insert into dentist_payout_requests (dentist_id, bank_account_holder, bank_account_no, bank_ifsc, pan, gstin)
         values ($1,$2,$3,$4,$5,$6) returning *`,
        [
          dentistId,
          input.bankAccountHolder,
          input.bankAccountNo,
          input.bankIfsc,
          input.pan,
          input.gstin ?? null,
        ],
      );
      await this.audit.log(
        {
          actorUserId: dentistId,
          action: 'payout_submitted',
          entityType: 'dentist',
          entityId: dentistId,
          afterState: { requestId: rows[0].id, status: 'pending' },
        },
        client,
      );
      await client.query('COMMIT');
      return requestResponse(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async adminProfile(adminId: string, dentistId: string) {
    await this.requireAdmin(adminId);
    return this.profile(dentistId);
  }

  async review(
    adminId: string,
    requestId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await this.requireAdmin(adminId, client);
      const found = await client.query<{ dentist_id: string }>(
        'select dentist_id from dentist_payout_requests where id = $1',
        [requestId],
      );
      if (!found.rows[0])
        throw new NotFoundException('No such payout request.');
      const dentistId = found.rows[0].dentist_id;
      // Submission and all review decisions lock in the same order.
      await this.lockDentist(client, dentistId, decision === 'approved');
      const { rows } = await client.query<RequestRow>(
        'select * from dentist_payout_requests where id = $1 for update',
        [requestId],
      );
      const proposal = rows[0];
      if (proposal.status !== 'pending')
        throw new ConflictException(
          'This payout request has already been reviewed.',
        );
      if (decision === 'approved') {
        await client.query(
          `update dentists set bank_account_holder = $2, bank_account_no = $3, bank_ifsc = $4,
           pan = $5, gstin = $6, updated_at = now() where user_id = $1`,
          [
            dentistId,
            proposal.bank_account_holder,
            proposal.bank_account_no,
            proposal.bank_ifsc,
            proposal.pan,
            proposal.gstin,
          ],
        );
      }
      const reviewed = await client.query<RequestRow>(
        `update dentist_payout_requests set status = $2, reviewed_by = $3, reviewed_at = now(), rejection_reason = $4
         where id = $1 returning *`,
        [requestId, decision, adminId, decision === 'rejected' ? reason : null],
      );
      // Keep bank and tax identifiers out of the general-purpose audit feed.
      await this.audit.log(
        {
          actorUserId: adminId,
          action: `payout_${decision}`,
          entityType: 'dentist',
          entityId: dentistId,
          beforeState: { requestId, status: 'pending' },
          afterState: { requestId, status: decision },
        },
        client,
      );
      await client.query('COMMIT');
      return requestResponse(reviewed.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async list(adminId: string, filters: ListPayoutRequestsDto) {
    await this.requireAdmin(adminId);
    const limit = 20;
    const { rows } = await this.pool.query<{
      id: string;
      dentist_id: string;
      dentist_name: string;
      mobile: string;
      status: string;
      submitted_at: Date;
      reviewed_at: Date | null;
    }>(
      `select r.id, r.dentist_id, d.full_name as dentist_name, u.mobile, r.status, r.submitted_at, r.reviewed_at
       from dentist_payout_requests r join dentists d on d.user_id = r.dentist_id join users u on u.id = d.user_id
       where r.status = $1 order by r.submitted_at desc, r.id desc limit $2 offset $3`,
      [filters.status, limit + 1, (filters.page - 1) * limit],
    );
    return {
      items: rows.slice(0, limit).map((row) => ({
        id: row.id,
        dentistId: row.dentist_id,
        dentistName: row.dentist_name,
        mobile: row.mobile,
        status: row.status,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
      })),
      nextPage: rows.length > limit ? filters.page + 1 : null,
    };
  }

  private async lockDentist(
    client: PoolClient,
    dentistId: string,
    requireVerified: boolean,
  ) {
    const { rows } = await client.query<{ status: string }>(
      'select status from dentists where user_id = $1 for update',
      [dentistId],
    );
    if (!rows[0]) throw new NotFoundException('No such dentist.');
    if (requireVerified && rows[0].status !== 'verified')
      throw new ConflictException(
        'The dentist must be verified before submitting or approving payout details.',
      );
  }

  private async requireAdmin(
    adminId: string,
    database: Pool | PoolClient = this.pool,
  ) {
    const { rows } = await database.query(
      `select id from users where id = $1 and role = 'admin' and status = 'active' ${
        database === this.pool ? '' : 'for share'
      }`,
      [adminId],
    );
    if (!rows[0])
      throw new ForbiddenException('This admin account is unavailable.');
  }
}
