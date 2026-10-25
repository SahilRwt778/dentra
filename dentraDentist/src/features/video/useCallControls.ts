import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useCallControls(
  minimized: boolean,
  report: (message: string) => void,
) {
  const [visible, setVisible] = useState(true);
  const [activity, setActivity] = useState(0);
  const [screenReader, setScreenReader] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then(enabled => {
        if (mounted.current) setScreenReader(enabled);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setScreenReader,
    );
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    setVisible(true);
  }, [minimized]);
  useEffect(() => {
    if (minimized || !visible || screenReader || busy) return;
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [activity, busy, minimized, screenReader, visible]);
  function reveal() {
    setVisible(true);
    setActivity(value => value + 1);
  }
  async function change(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    reveal();
    setBusy(true);
    try {
      await action();
    } catch (error) {
      if (mounted.current)
        report(
          error instanceof Error
            ? error.message
            : 'Could not update the call controls. Please try again.',
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    visible: minimized || visible || screenReader || busy,
    busy,
    reveal,
    change,
  };
}
