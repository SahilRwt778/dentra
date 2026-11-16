-- Up Migration
CREATE TABLE consultation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE RESTRICT,
  patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE RESTRICT,
  dentist_id uuid NOT NULL REFERENCES dentists(user_id) ON DELETE RESTRICT,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((activated_at IS NULL AND expires_at IS NULL) OR
         (activated_at IS NOT NULL AND expires_at > activated_at))
);
ALTER TABLE appointments ADD COLUMN consultation_case_id uuid REFERENCES consultation_cases(id) ON DELETE RESTRICT;
ALTER TABLE appointments ADD COLUMN follow_up_of uuid REFERENCES appointments(id) ON DELETE RESTRICT;
ALTER TABLE appointments ADD COLUMN booking_key text;
CREATE UNIQUE INDEX appointments_booking_key_uidx ON appointments(booking_key) WHERE booking_key IS NOT NULL;
ALTER TABLE appointments ADD CONSTRAINT appointments_follow_up_case_check CHECK
  (follow_up_of IS NULL OR (follow_up_of <> id AND consultation_case_id IS NOT NULL));
CREATE INDEX appointments_case_idx ON appointments(consultation_case_id);
CREATE INDEX consultation_cases_patient_idx ON consultation_cases(patient_id, created_at DESC);
CREATE INDEX consultation_cases_dentist_idx ON consultation_cases(dentist_id, created_at DESC);
CREATE TABLE consultation_chat_reads (
  case_id uuid NOT NULL REFERENCES consultation_cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence>=0),
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(case_id,user_id)
);
CREATE UNIQUE INDEX notifications_consultation_message_unread_uidx
  ON notifications(user_id, (payload->>'caseId'))
  WHERE template_key='consultation_message' AND channel='in_app' AND read_at IS NULL;
-- Each existing visit becomes its own case. Existing chat remains on that original appointment.
INSERT INTO consultation_cases(original_appointment_id,patient_id,dentist_id,activated_at,expires_at)
SELECT a.id,a.patient_id,a.dentist_id,
  CASE WHEN a.status='completed' AND EXISTS(SELECT 1 FROM transactions t WHERE t.appointment_id=a.id AND t.status='paid' AND t.amount_paise>0) THEN a.completed_at END,
  CASE WHEN a.status='completed' AND EXISTS(SELECT 1 FROM transactions t WHERE t.appointment_id=a.id AND t.status='paid' AND t.amount_paise>0) THEN a.completed_at+interval '72 hours' END
FROM appointments a;
UPDATE appointments a SET consultation_case_id=c.id FROM consultation_cases c WHERE c.original_appointment_id=a.id;
UPDATE appointments a SET booking_key=t.idempotency_key FROM
  (SELECT DISTINCT ON(appointment_id) appointment_id,idempotency_key FROM transactions ORDER BY appointment_id,created_at,id) t
  WHERE t.appointment_id=a.id;

-- Down Migration
-- Financial and clinical records must be preserved; roll back application code rather than deleting cases.
DO $$ BEGIN RAISE EXCEPTION 'Consultation cases contain clinical history; use a reviewed forward migration.'; END $$;
