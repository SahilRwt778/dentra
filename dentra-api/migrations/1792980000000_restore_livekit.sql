-- Up Migration
-- End legacy provider sessions; appointment/chat/clinical records are preserved.
UPDATE video_rooms SET closed_at = coalesce(closed_at, now()), cleaned_at = now()
WHERE provider <> 'livekit';
ALTER TABLE video_rooms RENAME COLUMN provider_meeting_id TO provider_room_id;
ALTER TABLE video_rooms RENAME COLUMN patient_attendee_id TO patient_identity;
ALTER TABLE video_rooms RENAME COLUMN dentist_attendee_id TO dentist_identity;
ALTER INDEX video_rooms_chime_meeting_uidx RENAME TO video_rooms_provider_room_uidx;

-- Down Migration
UPDATE video_rooms SET closed_at = coalesce(closed_at, now()), cleaned_at = now()
WHERE provider = 'livekit';
ALTER INDEX video_rooms_provider_room_uidx RENAME TO video_rooms_chime_meeting_uidx;
ALTER TABLE video_rooms RENAME COLUMN provider_room_id TO provider_meeting_id;
ALTER TABLE video_rooms RENAME COLUMN patient_identity TO patient_attendee_id;
ALTER TABLE video_rooms RENAME COLUMN dentist_identity TO dentist_attendee_id;
