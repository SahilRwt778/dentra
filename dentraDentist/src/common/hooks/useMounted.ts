import { useEffect, useRef } from 'react';

/** A draft can finish saving while another stack screen covers it. */
export function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
