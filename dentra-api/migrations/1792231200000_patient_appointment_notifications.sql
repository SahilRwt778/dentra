-- Up Migration
CREATE UNIQUE INDEX IF NOT EXISTS notifications_patient_event_uidx
  ON notifications (user_id, template_key, (payload->>'eventKey'))
  WHERE template_key IN ('booking_confirmed', 'appointment_cancelled', 'appointment_rescheduled',
    'appointment_reminder', 'visit_summary_ready');

-- Down Migration
DROP INDEX IF EXISTS notifications_patient_event_uidx;
