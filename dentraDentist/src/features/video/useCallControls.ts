import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useMediaControls } from '@dentra/video/src/useMediaControls';

export function useCallControls(
  minimized: boolean,
  report: (message: string) => void,
) {
  const [visible, setVisible] = useState(true);
  const [activity, setActivity] = useState(0);
  const [screenReader, setScreenReader] = useState(false);
  const media = useMediaControls(report);
  const { busy } = media;
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
  function change(...args: Parameters<typeof media.change>) {
    reveal();
    return media.change(...args);
  }
  return {
    visible: minimized || visible || screenReader || busy,
    busy,
    isBusy: media.isBusy,
    reveal,
    change,
  };
}
