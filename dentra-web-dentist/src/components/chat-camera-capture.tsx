import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

async function capturePhoto(video: HTMLVideoElement): Promise<File> {
  if (!video.videoWidth || !video.videoHeight)
    throw new Error('Wait for the camera preview to start.');
  const scale = Math.min(
    1,
    2400 / Math.max(video.videoWidth, video.videoHeight)
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not capture a photo in this browser.');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error('Could not capture the photo.')),
      'image/jpeg',
      0.8
    );
  });
  return new File([blob], `Photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

/** Owns only a cloned track or a new photo stream, never the call's camera track. */
export function ChatCameraCapture({
  sourceTrack,
  onCapture,
  onClose,
}: {
  sourceTrack?: MediaStreamTrack;
  onCapture(file: File): void;
  onClose(): void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const active = useRef(true);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let disposed = false;
    let stream: MediaStream | undefined;
    active.current = true;
    setReady(false);
    async function start() {
      try {
        const owned =
          sourceTrack?.readyState === 'live'
            ? new MediaStream([sourceTrack.clone()])
            : await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'environment' },
              });
        if (disposed) {
          owned.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = owned;
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
      } catch {
        if (!disposed)
          setError(
            'Could not open the camera. Allow camera access or choose a photo from Gallery.'
          );
      }
    }
    void start();
    return () => {
      disposed = true;
      active.current = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [sourceTrack]);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);

  async function capture() {
    if (!video.current || capturing || !ready) return;
    setCapturing(true);
    setError(undefined);
    try {
      const file = await capturePhoto(video.current);
      if (active.current) onCapture(file);
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not capture the photo.'
        );
    } finally {
      if (active.current) setCapturing(false);
    }
  }

  return (
    <div
      className="call-chat-camera"
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo"
    >
      <header>
        <div>
          <strong>Take a photo</strong>
          <p>Your photo is previewed in chat before you send it.</p>
        </div>
        <button
          type="button"
          className="call-chat-remove"
          aria-label="Close camera"
          autoFocus
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label="Camera preview"
        onLoadedMetadata={() => setReady(true)}
      />
      {error && (
        <p role="alert" className="call-chat-error">
          {error}
        </p>
      )}
      <footer>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready || capturing}
          onClick={() => void capture()}
        >
          <Camera size={18} /> {capturing ? 'Capturing…' : 'Take photo'}
        </button>
      </footer>
    </div>
  );
}
