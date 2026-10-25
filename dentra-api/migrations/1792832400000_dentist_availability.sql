-- Up Migration
-- Preserve existing availability: every day remains open until a dentist edits it.
ALTER TABLE dentists ADD COLUMN video_working_days smallint[] NOT NULL DEFAULT array[0,1,2,3,4,5,6]::smallint[]
  CHECK (video_working_days <@ array[0,1,2,3,4,5,6]::smallint[] AND array_position(video_working_days, null) IS NULL);
ALTER TABLE dentist_clinics ADD COLUMN working_days smallint[] NOT NULL DEFAULT array[0,1,2,3,4,5,6]::smallint[]
  CHECK (working_days <@ array[0,1,2,3,4,5,6]::smallint[] AND array_position(working_days, null) IS NULL);
create table dentist_time_off (
  id uuid primary key,
  dentist_id uuid not null references dentists(user_id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date and end_date - start_date <= 365),
  all_day boolean not null,
  start_minute smallint not null check (start_minute >= 0),
  end_minute smallint not null check (end_minute <= 1440 and end_minute > start_minute),
  reason varchar(200),
  created_at timestamptz not null default now(),
  check (not all_day or (start_minute = 0 and end_minute = 1440))
);
create index dentist_time_off_dates_idx on dentist_time_off (dentist_id, start_date, end_date);

-- Down Migration
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM dentist_time_off) THEN
    RAISE EXCEPTION 'Remove saved time off before rolling back availability storage.';
  END IF;
END $$;
DROP TABLE dentist_time_off;
ALTER TABLE dentist_clinics DROP COLUMN working_days;
ALTER TABLE dentists DROP COLUMN video_working_days;
