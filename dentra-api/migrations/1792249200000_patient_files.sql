-- Up Migration
CREATE TABLE patient_files (
  id uuid PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES patients(user_id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES appointments(id) ON DELETE RESTRICT,
  upload_key uuid NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  deleted_at timestamptz,
  purged_at timestamptz,
  UNIQUE (patient_id, upload_key)
);
CREATE INDEX patient_files_patient_idx ON patient_files (patient_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX patient_files_appointment_idx ON patient_files (appointment_id) WHERE deleted_at IS NULL;
CREATE INDEX patient_files_cleanup_idx ON patient_files (expires_at) WHERE appointment_id IS NULL AND purged_at IS NULL;

-- Down Migration
DO $$ BEGIN
  RAISE EXCEPTION 'Patient files require an explicit archival plan before rollback.';
END $$;
