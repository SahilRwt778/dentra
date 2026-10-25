import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';

type Point = { x: number; y: number };
const GAP = 12;

export function useMovableCallWindow(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [position, setPosition] = useState<Point | null>(null);
  const savedPosition = useRef<Point | null>(null);
  const drag = useRef<{
    pointerId: number;
    origin: Point;
    start: Point;
  } | null>(null);

  const move = useCallback(
    (point: Point) => {
      const bounds = ref.current?.getBoundingClientRect();
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
      const next = {
        x: Math.max(GAP, Math.min(window.innerWidth - bounds.width - GAP, point.x)),
        y: Math.max(GAP, Math.min(window.innerHeight - bounds.height - GAP, point.y)),
      };
      savedPosition.current = next;
      setPosition((current) => (current?.x === next.x && current.y === next.y ? current : next));
    },
    [ref],
  );

  useLayoutEffect(() => {
    if (!enabled) {
      drag.current = null;
      return;
    }
    function keepVisible() {
      const bounds = ref.current?.getBoundingClientRect();
      if (bounds) move(savedPosition.current ?? { x: bounds.left, y: bounds.top });
    }
    keepVisible();
    const observer = new ResizeObserver(keepVisible);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', keepVisible);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', keepVisible);
    };
  }, [enabled, move, ref]);

  function stop(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return {
    style:
      enabled && position
        ? {
            left: position.x,
            top: position.y,
            right: 'auto',
            bottom: 'auto',
          }
        : undefined,
    handleProps: {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (!enabled || !event.isPrimary || event.button !== 0 || !savedPosition.current) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          origin: savedPosition.current,
          start: { x: event.clientX, y: event.clientY },
        };
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        move({
          x: current.origin.x + event.clientX - current.start.x,
          y: current.origin.y + event.clientY - current.start.y,
        });
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onLostPointerCapture: () => {
        drag.current = null;
      },
      onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (!enabled || !savedPosition.current) return;
        const step = event.shiftKey ? 50 : 20;
        const offset: Record<string, Point> = {
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
        };
        const delta = offset[event.key];
        if (!delta && event.key !== 'Home') return;
        event.preventDefault();
        const current = savedPosition.current;
        move(
          event.key === 'Home'
            ? { x: Infinity, y: Infinity }
            : {
                x: current.x + delta.x,
                y: current.y + delta.y,
              },
        );
      },
    },
  };
}
