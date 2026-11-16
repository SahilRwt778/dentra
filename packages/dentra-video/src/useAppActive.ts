import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Focused navigation screens can still be behind the phone's Home screen. */
export function useAppActive() {
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  return active;
}
