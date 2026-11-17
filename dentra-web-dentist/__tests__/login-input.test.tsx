import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { LoginPage } from '../src/pages/login-page';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../src/auth/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    requestOtp: mocks.request,
    verifyOtp: vi.fn(),
  }),
}));
let tree: ReactTestRenderer;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.request.mockResolvedValue({ otpId: 'test-otp' });
  await act(async () => {
    tree = Renderer.create(<LoginPage />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  vi.unstubAllGlobals();
});

test('controls phone input and sends only a complete ten-digit national number with one country prefix', async () => {
  const input = () => tree.root.findByType('input');
  const submit = () => tree.root.findByProps({ type: 'submit' });
  await act(async () =>
    input().props.onChange({ target: { value: 'letters12a34' } }),
  );
  expect(input().props.value).toBe('1234');
  expect(input().props.maxLength).toBe(10);
  expect(submit().props.disabled).toBe(true);
  await act(async () => {
    await tree.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(mocks.request).not.toHaveBeenCalled();
  await act(async () =>
    input().props.onChange({ target: { value: '98765abc432109999' } }),
  );
  expect(input().props.value).toBe('9876543210');
  expect(submit().props.disabled).toBe(false);
  await act(async () => {
    await tree.root
      .findByType('form')
      .props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(mocks.request).toHaveBeenCalledWith('+919876543210');
});
