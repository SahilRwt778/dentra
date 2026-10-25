// Completion and provider capture are required. Clinic receipts, refund requests
// and an existing reservation exclude a payment regardless of its displayed method.
export const ELIGIBLE_PAYMENT = `a.status = 'completed' and t.status = 'paid'
  and t.amount_paise > 0 and t.gateway_payment_ref is not null
  and not exists (select 1 from clinic_payment_collections cp where cp.transaction_id = t.id)
  and not exists (select 1 from payment_refunds r where r.transaction_id = t.id)`;
export const UNRESERVED_PAYMENT = `not exists (select 1 from payout_batch_items bi
  where (bi.transaction_id = t.id or bi.provider_payment_ref = t.gateway_payment_ref) and bi.released_at is null)`;

export const APPROVED_ACCOUNT = `select r.id, r.bank_account_holder, r.bank_account_no, r.bank_ifsc
  from dentist_payout_requests r join dentists d on d.user_id = r.dentist_id
  where r.dentist_id = $1 and r.status = 'approved'
    and r.bank_account_holder = d.bank_account_holder and r.bank_account_no = d.bank_account_no
    and r.bank_ifsc = d.bank_ifsc
  order by r.reviewed_at desc, r.id desc limit 1`;

export const BATCH_COLUMNS = `b.id, b.dentist_id as "dentistId", d.full_name as "dentistName",
  b.status, b.version, b.fee_bps as "feeBps", b.gross_paise::float8 as "grossPaise",
  b.fee_paise::float8 as "feePaise", b.net_paise::float8 as "netPaise",
  right(b.bank_account_no, 4) as "accountLast4", b.bank_ifsc as "bankIfsc",
  b.created_at as "createdAt", b.updated_at as "updatedAt", b.bank_reference as "bankReference",
  to_char(b.paid_on, 'YYYY-MM-DD') as "paidOn",
  exists (select 1 from payout_batch_items bi join transactions t on t.id = bi.transaction_id
    join appointments a on a.id = t.appointment_id where bi.batch_id = b.id
    and (t.amount_paise <> bi.amount_paise or t.gateway_payment_ref is distinct from bi.provider_payment_ref
      or not (${ELIGIBLE_PAYMENT}))) as "needsAttention"`;
