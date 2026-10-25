import { useEffect } from 'react';
import { AppState } from 'react-native';

export function useForegroundRefresh(
  refresh: () => unknown,
  enabled = true,
  intervalMs = 30000,
) {
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, intervalMs);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [enabled, intervalMs, refresh]);
}
