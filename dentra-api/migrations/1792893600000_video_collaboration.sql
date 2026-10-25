-- Up Migration
CREATE TABLE video_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  appointment_id uuid NOT NULL REFERENCES appointments(id),
  sender_id uuid NOT NULL REFERENCES users(id),
  sender_role text NOT NULL CHECK (sender_role IN ('patient','dentist')),
  request_id uuid NOT NULL,
  body text NOT NULL DEFAULT '' CHECK (length(body)<=4000),
  content_hash text NOT NULL,
  file_name text,
  mime_type text CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  size_bytes integer CHECK (size_bytes BETWEEN 1 AND 10485760),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id,sender_id,request_id),
  CHECK (length(btrim(body))>0 OR file_name IS NOT NULL),
  CHECK ((file_name IS NULL AND mime_type IS NULL AND size_bytes IS NULL) OR
         (file_name IS NOT NULL AND mime_type IS NOT NULL AND size_bytes IS NOT NULL))
);
CREATE INDEX video_chat_messages_appointment_sequence_idx ON video_chat_messages(appointment_id,sequence);

-- Down Migration
DROP TABLE video_chat_messages;
