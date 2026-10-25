-- Up Migration
ALTER TABLE video_rooms ADD COLUMN provider text NOT NULL DEFAULT 'livekit',
  ADD COLUMN provider_meeting_id text,
  ADD COLUMN patient_attendee_id text,
  ADD COLUMN dentist_attendee_id text;
CREATE UNIQUE INDEX video_rooms_chime_meeting_uidx ON video_rooms(provider_meeting_id) WHERE provider_meeting_id IS NOT NULL;

-- Down Migration
DROP INDEX video_rooms_chime_meeting_uidx;
ALTER TABLE video_rooms DROP COLUMN provider, DROP COLUMN provider_meeting_id,
  DROP COLUMN patient_attendee_id, DROP COLUMN dentist_attendee_id;
