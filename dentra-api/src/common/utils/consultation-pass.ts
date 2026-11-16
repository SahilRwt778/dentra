import type { PoolClient } from 'pg';

/** Coverage belongs to the original paid visit; follow-ups never earn another pass. */
export async function activateConsultationPass(
  client: PoolClient,
  appointmentId: string,
) {
  await client.query(
    `with eligible as (
    select a.id, a.patient_id, a.dentist_id, a.completed_at from appointments a
    where exists (select 1 from transactions t where t.appointment_id=a.id and t.status='paid' and t.amount_paise>0)
      and a.id=$1 and a.follow_up_of is null and a.status='completed' and a.completed_at is not null
  ), saved as (
    insert into consultation_cases (original_appointment_id,patient_id,dentist_id,activated_at,expires_at)
    select id,patient_id,dentist_id,completed_at,completed_at+interval '72 hours' from eligible
    on conflict(original_appointment_id) do update set
      activated_at=coalesce(consultation_cases.activated_at,excluded.activated_at),
      expires_at=coalesce(consultation_cases.expires_at,excluded.expires_at)
    returning id,original_appointment_id
  ) update appointments a set consultation_case_id=s.id from saved s where a.id=s.original_appointment_id`,
    [appointmentId],
  );
}

/** A reserved follow-up stays covered for its scheduled slot, including its normal call duration. */
export function coveredFollowUp(alias: string) {
  return `(${alias}.follow_up_of is not null and exists (
    select 1 from consultation_cases coverage join appointments origin on origin.id=coverage.original_appointment_id
    join transactions paid on paid.appointment_id=origin.id and paid.status='paid' and paid.amount_paise>0
    where coverage.id=${alias}.consultation_case_id and coverage.original_appointment_id=${alias}.follow_up_of
      and coverage.patient_id=${alias}.patient_id and coverage.dentist_id=${alias}.dentist_id
      and origin.status='completed' and coverage.activated_at is not null
      and exists(select 1 from users pu where pu.id=coverage.patient_id and pu.status='active')
      and exists(select 1 from users du join dentists dd on dd.user_id=du.id where du.id=coverage.dentist_id and du.status='active' and dd.status='verified')
      and (${alias}.scheduled_date+${alias}.scheduled_time) at time zone 'Asia/Kolkata'>=coverage.activated_at
      and (${alias}.scheduled_date+${alias}.scheduled_time) at time zone 'Asia/Kolkata'<coverage.expires_at
  ))`;
}

/** Clinic follow-ups must start during the pass; reserved video visits keep their normal two-hour room window. */
export function canStartFollowUp(alias: string) {
  return `(${coveredFollowUp(alias)} and clock_timestamp() < (
    select case when ${alias}.type='video'
      then ((${alias}.scheduled_date+${alias}.scheduled_time) at time zone 'Asia/Kolkata')+interval '2 hours'
      else coverage.expires_at end
    from consultation_cases coverage where coverage.id=${alias}.consultation_case_id
  ))`;
}
