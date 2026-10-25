-- Up Migration
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dentist_onboarding_uidx
  ON notifications (user_id, template_key, (payload->>'dentistId'))
  WHERE template_key = 'dentist_onboarding_submitted';

-- Down Migration
DROP INDEX IF EXISTS notifications_dentist_onboarding_uidx;
