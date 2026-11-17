import { useEffect } from 'react';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ConsultationWorkspace } from '../src/components/consultation-workspace';

vi.mock('../src/components/use-movable-call-window', () => ({
  useMovableCallWindow: () => ({ style: undefined, handleProps: {} }),
}));
let tree: ReactTestRenderer;
const mounted = vi.fn();
const unmounted = vi.fn();
const listeners = new Map<string, (event: any) => void>();
const mediaWindow = {
  addEventListener: (type: string, callback: (event: any) => void) =>
    listeners.set(type, callback),
  removeEventListener: (type: string) => listeners.delete(type),
};
function MediaProbe() {
  useEffect(() => {
    mounted();
    return () => {
      unmounted();
    };
  }, []);
  return <div className="consult-call-stage">Video</div>;
}
function windowNode() {
  return tree.root.findByProps({ className: 'consult-media-window' });
}
async function toggle() {
  await act(async () =>
    tree.root.findByProps({ 'data-call-overlay-toggle': true }).props.onClick(),
  );
}
async function wait(milliseconds: number) {
  await act(async () => vi.advanceTimersByTime(milliseconds));
}
beforeEach(async () => {
  vi.clearAllMocks();
  listeners.clear();
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('HTMLElement', class {});
  vi.stubGlobal('document', { body: { style: {} }, activeElement: null });
  await act(async () => {
    tree = Renderer.create(
      <ConsultationWorkspace
        active
        patientName="Synthetic patient"
        panels={[]}
        actions={null}
        call={<MediaProbe />}
      />,
      {
        createNodeMock: (element) =>
          element.props.className === 'consult-media-window'
            ? mediaWindow
            : element.type === 'section'
            ? { querySelector: () => ({ focus: vi.fn() }) }
            : null,
      },
    );
  });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('desktop clicks and inactivity toggle the header and controls without remounting media', async () => {
  expect(windowNode().props['data-controls-visible']).toBe(true);
  await toggle();
  expect(windowNode().props['data-controls-visible']).toBe(false);
  await toggle();
  expect(windowNode().props['data-controls-visible']).toBe(true);
  await wait(4000);
  expect(windowNode().props['data-controls-visible']).toBe(false);
  await toggle();
  expect(windowNode().props['data-controls-visible']).toBe(true);
  expect(mounted).toHaveBeenCalledOnce();
  expect(unmounted).not.toHaveBeenCalled();
});

test('using a control inside the portal restarts the idle period', async () => {
  await wait(3000);
  await act(async () =>
    listeners.get('pointerdown')!({ target: { closest: () => ({}) } }),
  );
  await wait(3000);
  expect(windowNode().props['data-controls-visible']).toBe(true);
  await wait(1000);
  expect(windowNode().props['data-controls-visible']).toBe(false);
});

test('keyboard users keep focused controls visible and Escape restores hidden controls', async () => {
  await act(async () =>
    listeners.get('focusin')!({
      target: { closest: () => ({}), matches: () => true },
    }),
  );
  await wait(10000);
  expect(windowNode().props['data-controls-visible']).toBe(true);
  await act(async () => listeners.get('focusout')!({ relatedTarget: null }));
  await wait(4000);
  expect(windowNode().props['data-controls-visible']).toBe(false);
  await act(async () =>
    listeners.get('keydown')!({ key: 'Escape', target: null }),
  );
  expect(windowNode().props['data-controls-visible']).toBe(true);
});

test('minimizing and restoring reveals the controls and preserves the media instance', async () => {
  await wait(4000);
  await toggle();
  await act(async () =>
    tree.root.findByProps({ 'aria-label': 'Minimize call' }).props.onClick(),
  );
  await wait(5000);
  expect(windowNode().props['data-controls-visible']).toBe(true);
  await act(async () =>
    tree.root
      .findByProps({ 'aria-label': 'Restore full-screen call' })
      .props.onClick(),
  );
  expect(windowNode().props['data-controls-visible']).toBe(true);
  expect(mounted).toHaveBeenCalledOnce();
  expect(unmounted).not.toHaveBeenCalled();
});
