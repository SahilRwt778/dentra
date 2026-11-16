# Registration profile photos

Patient Mobile registration and Dentist Mobile/Web onboarding include an optional profile photo. Mobile users can choose the gallery or front camera. The circular preview is 96 points/pixels with a red remove button; selection stays on the device until the form is submitted. JPEG/PNG only, up to 5 MB. Native picker output is resized to at most 512 × 512 while preserving aspect ratio.

## Apply before deploying the API

Use the normal migration workflow for `dentra-api/migrations/1794839400000_profile_photos.sql`. If applying through the Supabase SQL Editor, run only its **Up Migration** section:

```sql
ALTER TABLE patients ADD COLUMN profile_photo_url text;
COMMENT ON COLUMN patients.profile_photo_url IS 'Private profile photo storage reference; API returns an expiring image URL.';
COMMENT ON COLUMN dentists.profile_photo_url IS 'Private profile photo storage reference; API returns an expiring image URL.';
```

The dentist column already exists. No new table, bucket, secret, native package or native configuration is needed. Deploy the API, then the web portals; reload the mobile JavaScript. Existing accounts remain valid without photos. Dentist Mobile also supports replacing/removing a picture in Profile → Edit profile. Patient photo editing and dentist web photo editing are not yet exposed in their settings screens.

## API and storage

- JSON-only requests still work. With a photo, `POST /patients/register`, `POST /dentists/applications`, and `PATCH /dentists/applications/me` accept multipart `details` (the JSON-encoded existing DTO) and `profilePhoto` (the image).
- `PATCH /dentists/me` accepts the same multipart shape for an approved dentist editing their own profile. JSON `removeProfilePhoto: true` removes the picture. Sending a new image and that flag together is rejected. Selection/removal/undo in Dentist Mobile are local until Save changes; success refreshes the Redux dentist profile.
- Existing DTO/consent checks still apply, including guardian consent and dentist draft restrictions. Profile photos do not replace the required KYC selfie or grant dentist approval.
- The backend checks the file bytes and size. It saves an immutable object under `profile-photos/{role}/{userId}/{randomId}.jpg|png` in the existing private Supabase bucket, or under the configured local patient files directory in local-storage mode.
- `patients.profile_photo_url` and `dentists.profile_photo_url` hold internal object references, never a client-supplied URL or image data. Registration/application writes and their reference commit together. Failed database writes clean up the new object; an ambiguous commit retains it to avoid deleting a possibly saved image. Draft replacements clean up the previous object only after commit.
- Profile responses return `profilePhotoUrl`, an image-specific signed path relative to the API origin, valid for one hour. The image route validates the signature against the current photo reference and active account. It returns `private, no-store` and never uses an access token in the URL. Replacing an image invalidates earlier links immediately. Patient image links are returned only by existing authorized patient-profile responses; verified dentist photos are also included in public dentist discovery.
- Saved pictures display in the patient's own profile, patient dentist discovery/picker, dentist mobile profile, dentist web sidebar/settings, and admin dentist detail/onboarding review. Initials remain the fallback when no image is available.

## Verification

1. Register a new patient with a gallery photo, confirm its preview, then submit. Check the profile after signing out and back in.
2. Start a new dentist application on mobile or web with a profile photo. Check its draft after reopening and its admin review after submission. Required KYC documents remain independent.
3. Remove a selected image before submitting, or register without selecting one; registration should still work.
4. Camera/gallery cancellation and permission denial preserve the current selection. Invalid/PDF/oversized uploads are rejected without creating a profile.

Focused automated coverage includes native photo selection/removal/cancellation, existing dentist onboarding, JSON-only registration, multipart registration, file validation, signed-link tampering/expiry/owner changes, draft replacement and disabled accounts. Tests use disposable database schemas and local files; hosted accounts/storage were not changed.
