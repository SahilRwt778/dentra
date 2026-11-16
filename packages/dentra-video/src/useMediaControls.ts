import { useEffect, useRef, useState } from 'react';

type MediaControl = 'microphone' | 'camera' | 'screenShare';

/** A device prompt must not block unrelated call controls. Camera switching shares the camera lock. */
export function useMediaControls(report: (message: string) => void) {
  const locks = useRef(new Set<MediaControl>());
  const mounted = useRef(true);
  const [pending, setPending] = useState({
    microphone: false,
    camera: false,
    screenShare: false,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function change(control: MediaControl, action: () => Promise<unknown>) {
    if (locks.current.has(control)) return;
    locks.current.add(control);
    setPending((value) => ({ ...value, [control]: true }));
    try {
      await action();
    } catch (error) {
      if (mounted.current) {
        report(
          error instanceof Error
            ? error.message
            : 'Could not update this call control. Please try again.',
        );
      }
    } finally {
      locks.current.delete(control);
      if (mounted.current)
        setPending((value) => ({ ...value, [control]: false }));
    }
  }

  return {
    busy: Object.values(pending).some(Boolean),
    isBusy: (control: MediaControl) => pending[control],
    change,
  };
}
