import { useEffect, useMemo, useState } from 'react';

/** Slot dates and times are clinic wall-clock values in India, not device-local times. */
export function isFutureSlot(date: string, time: string, now = Date.now()) {
  return Date.parse(`${date}T${time}:00+05:30`) > now;
}

/** Expire cached slots at each minute boundary even while the picker stays open. */
export function useAvailableSlots(
  date: string,
  slots: readonly string[] | undefined,
  expiresAt?: string,
) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      const current = Date.now();
      setNow(current);
      timer = setTimeout(tick, 60000 - (current % 60000));
    }
    timer = setTimeout(tick, 60000 - (Date.now() % 60000));
    return () => clearTimeout(timer);
  }, []);
  return useMemo(() => {
    const deadline = expiresAt ? Date.parse(expiresAt) : Infinity;
    return slots?.filter(
      (time) =>
        isFutureSlot(date, time, now) &&
        Date.parse(`${date}T${time}:00+05:30`) < deadline,
    );
  }, [date, slots, expiresAt, now]);
}
