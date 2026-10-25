-- Up Migration
ALTER TABLE consultations ADD COLUMN plan_items jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(plan_items) = 'array' AND jsonb_array_length(plan_items) <= 20);

-- Down Migration
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM consultations WHERE plan_items <> '[]'::jsonb) THEN
    RAISE EXCEPTION 'Archive treatment plan items before removing their storage.';
  END IF;
END $$;
ALTER TABLE consultations DROP COLUMN plan_items;
