import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { APPROVED_ACCOUNT } from './payout-batch.queries';
export type WalletDatabase = Pool | PoolClient;
export type WalletAccount = {
  id: string;
  bank_account_holder: string;
  bank_account_no: string;
  bank_ifsc: string;
};
export async function approvedWalletAccount(
  database: WalletDatabase,
  dentistId: string,
) {
  return (
    (await database.query<WalletAccount>(APPROVED_ACCOUNT, [dentistId]))
      .rows[0] ?? null
  );
}
export async function lockWalletOwner(
  client: PoolClient,
  dentistId: string,
  verified = true,
) {
  const {
    rows: [dentist],
  } = await client.query(
    `select d.full_name,d.status,u.status as user_status from dentists d join users u on u.id=d.user_id where d.user_id=$1 for update of d`,
    [dentistId],
  );
  if (!dentist) throw new NotFoundException('No such dentist.');
  if (
    verified &&
    (dentist.status !== 'verified' || dentist.user_status !== 'active')
  )
    throw new ConflictException('The dentist must be active and verified.');
  return dentist as { full_name: string; status: string; user_status: string };
}
export async function requireWalletAdmin(
  database: WalletDatabase,
  adminId: string,
) {
  const { rows } = await database.query(
    "select id from users where id=$1 and role='admin' and status='active'",
    [adminId],
  );
  if (!rows[0])
    throw new ForbiddenException('This admin account is unavailable.');
}
