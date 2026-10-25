-- Up Migration
ALTER TYPE notification_channel ADD VALUE IF NOT EXISTS 'in_app';
CREATE UNIQUE INDEX IF NOT EXISTS notifications_appointment_booked_uidx
  ON notifications (user_id, template_key, (payload->>'appointmentId'))
  WHERE template_key = 'appointment_booked';

-- Down Migration
DROP INDEX IF EXISTS notifications_appointment_booked_uidx;
-- Keep the enum value so existing notification history remains readable.
