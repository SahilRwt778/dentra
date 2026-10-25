import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';

/** Async saves must not navigate or show messages in a screen the user has left. */
export function useScreenActive() {
  const focused = useIsFocused();
  const active = useRef(focused);
  active.current = focused;
  useEffect(() => {
    active.current = focused;
    return () => {
      active.current = false;
    };
  }, [focused]);
  return active;
}
