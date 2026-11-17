import { profilePhotoUrl } from '@/lib/profile-photo';
import { useEffect, useRef, useState } from 'react';
import { Camera, UserRound, X } from 'lucide-react';

export function ProfilePhotoField({
  value,
  onChange,
  existingUrl,
  onRemoveExisting,
  disabled = false,
}: {
  value: File | null;
  onChange: (photo: File | null) => void;
  existingUrl?: string | null;
  onRemoveExisting?: () => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview, value],
  );
  const image = value ? preview : profilePhotoUrl(existingUrl);
  return (
    <div className="profile-photo-field">
      <span className="small" style={{ fontWeight: 600 }}>
        Profile photo (optional)
      </span>
      <div className="profile-photo-row">
        <div className="profile-photo-preview">
          {image ? (
            <img src={image} alt="Profile photo preview" />
          ) : (
            <UserRound size={36} />
          )}
          {(value || (existingUrl && onRemoveExisting)) && (
            <button
              type="button"
              className="profile-photo-remove"
              aria-label={
                value ? 'Remove selected profile photo' : 'Remove profile photo'
              }
              disabled={disabled}
              onClick={() => {
                if (value) onChange(null);
                else onRemoveExisting?.();
                setPreview(undefined);
                setError(undefined);
                if (input.current) input.current.value = '';
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <Camera size={17} /> Choose photo
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png"
            aria-label="Choose profile photo"
            disabled={disabled}
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (
                !['image/jpeg', 'image/png'].includes(file.type) ||
                file.size <= 0 ||
                file.size > 5 * 1024 * 1024
              ) {
                setError('Choose a JPEG or PNG photo up to 5 MB.');
                event.target.value = '';
                return;
              }
              setError(undefined);
              setPreview(URL.createObjectURL(file));
              onChange(file);
            }}
          />
          <span className="hint">JPEG or PNG · Up to 5 MB</span>
        </div>
      </div>
      {error && (
        <p className="application-error small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
