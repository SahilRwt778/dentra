-- Up Migration
ALTER TABLE patients ADD COLUMN profile_photo_url text;
COMMENT ON COLUMN patients.profile_photo_url IS 'Private profile photo storage reference; API returns an expiring image URL.';
COMMENT ON COLUMN dentists.profile_photo_url IS 'Private profile photo storage reference; API returns an expiring image URL.';

-- Down Migration
ALTER TABLE patients DROP COLUMN profile_photo_url;
COMMENT ON COLUMN dentists.profile_photo_url IS NULL;
