-- Up Migration
CREATE TABLE care_documents (
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('prescription', 'visit-summary')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, kind)
);

-- Down Migration
DO $$ BEGIN
  RAISE EXCEPTION 'Care document snapshots require an explicit archival plan before rollback.';
END $$;
