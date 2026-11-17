import { useCallback, useEffect, useState, type RefObject } from 'react';

/** The room stays mounted; only its header and controls change visibility. */
export function useCallOverlays(
  active: boolean,
  mediaWindow: RefObject<HTMLDivElement | null>,
) {
  const [visible, setVisible] = useState(true);
  const [activity, setActivity] = useState(0);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const reveal = useCallback(() => {
    setVisible(true);
    setActivity((value) => value + 1);
  }, []);
  useEffect(() => {
    // Restoring the full-screen view starts a fresh visibility period.
    // oxlint-disable-next-line react/set-state-in-effect
    reveal();
  }, [active, reveal]);
  useEffect(() => {
    if (!active || !visible || keyboardFocus) return;
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [active, visible, activity, keyboardFocus]);
  useEffect(() => {
    const element = mediaWindow.current;
    if (!active || !element) return;
    const inControls = (target: EventTarget | null) =>
      !!(target as Element | null)?.closest?.('[data-call-controls]');
    function pointerDown(event: Event) {
      setKeyboardFocus(false);
      if (inControls(event.target)) reveal();
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') reveal();
      if (inControls(event.target)) {
        setKeyboardFocus(true);
        reveal();
      }
    }
    function focusIn(event: FocusEvent) {
      if (inControls(event.target)) {
        setKeyboardFocus((event.target as Element).matches(':focus-visible'));
        reveal();
      }
    }
    function focusOut(event: FocusEvent) {
      if (!inControls(event.relatedTarget)) setKeyboardFocus(false);
    }
    // Native listeners include the controls rendered into this window by a portal.
    element.addEventListener('pointerdown', pointerDown, true);
    element.addEventListener('keydown', keyDown, true);
    element.addEventListener('focusin', focusIn);
    element.addEventListener('focusout', focusOut);
    return () => {
      element.removeEventListener('pointerdown', pointerDown, true);
      element.removeEventListener('keydown', keyDown, true);
      element.removeEventListener('focusin', focusIn);
      element.removeEventListener('focusout', focusOut);
    };
  }, [active, mediaWindow, reveal]);
  function toggle() {
    setVisible((value) => !value);
    setActivity((value) => value + 1);
  }
  return { visible: !active || visible || keyboardFocus, toggle };
}
