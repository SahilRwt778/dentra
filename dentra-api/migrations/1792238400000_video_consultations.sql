-- Up Migration
CREATE TABLE video_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  room_name text NOT NULL UNIQUE,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  expires_at timestamptz NOT NULL,
  patient_session_id uuid,
  dentist_session_id uuid,
  closed_at timestamptz,
  cleaned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX video_rooms_active_uidx ON video_rooms (appointment_id) WHERE closed_at IS NULL;
CREATE INDEX video_rooms_cleanup_idx ON video_rooms (created_at) WHERE cleaned_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS video_rooms;
