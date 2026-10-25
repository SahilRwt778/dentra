import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type {
  PayoutDetails,
  PayoutProfile,
  PayoutRequest,
} from '../src/api/generated-api';
import { PayoutCard } from '../src/components/payout-card';

const mocks = vi.hoisted(() => ({
  profile: { approved: null, request: null } as PayoutProfile,
  error: undefined as unknown,
  submit: vi.fn(),
  unwrap: vi.fn(),
  refetch: vi.fn(),
  success: vi.fn(),
  failure: vi.fn(),
}));
vi.mock('@/api/generated-api', () => ({
  useGetDentistPayoutDetailsQuery: () => ({
    data: mocks.profile,
    error: mocks.error,
    isFetching: false,
    refetch: mocks.refetch,
  }),
  useSubmitDentistPayoutRequestMutation: () => [
    mocks.submit,
    { isLoading: false },
  ],
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.failure },
}));

const account: PayoutDetails = {
  bankAccountHolder: 'Test Dentist',
  bankAccountNo: '001234567890',
  bankIfsc: 'HDFC0001234',
  pan: 'ABCDE1234F',
  gstin: null,
};
function proposal(
  status: PayoutRequest['status'],
  id = 'old-request',
): PayoutRequest {
  return {
    ...account,
    id,
    dentistId: 'test-dentist',
    status,
    submittedAt: '2026-10-19T12:00:00Z',
    reviewedAt: null,
    rejectionReason: status === 'rejected' ? 'Correct the name.' : null,
  };
}
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = { approved: null, request: null };
  mocks.error = undefined;
  mocks.unwrap.mockReset().mockResolvedValue(proposal('pending'));
  mocks.submit.mockImplementation(() => ({ unwrap: mocks.unwrap }));
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
async function render() {
  await act(async () => {
    tree = Renderer.create(<PayoutCard />);
  });
}
async function click(label: string) {
  const button = tree.root
    .findAllByType('button')
    .find((node) => node.children.join('') === label);
  expect(button).toBeTruthy();
  await act(async () => button!.props.onClick());
}
function input(label: string) {
  const field = tree.root
    .findAllByType('label')
    .find((node) => node.findByType('span').props.children === label);
  return field!.findByType('input');
}
async function type(label: string, value: string) {
  await act(async () => input(label).props.onChange({ target: { value } }));
}
async function submit() {
  await act(async () =>
    tree.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() }),
  );
}

test('rejects mismatched account confirmation before sending a request', async () => {
  await render();
  await click('Add details');
  await type('Account number', account.bankAccountNo!);
  await type('Confirm account number', '9999999999');
  await submit();
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(mocks.failure).toHaveBeenCalledWith('Account numbers do not match.');
});

test('shows the approved account beside pending details and prevents another edit', async () => {
  mocks.profile = {
    approved: account,
    request: { ...proposal('pending'), bankAccountNo: '009876543210' },
  };
  await render();
  const content = JSON.stringify(tree.toJSON());
  expect(content).toContain(account.bankAccountNo);
  expect(content).toContain('009876543210');
  expect(content).toContain('Awaiting admin approval');
  expect(tree.root.findAllByType('form')).toHaveLength(0);
  expect(tree.root.findAllByType('button')).toHaveLength(0);
});

test('keeps the version from when editing began, so polling cannot authorize a stale form', async () => {
  mocks.profile = { approved: account, request: proposal('approved') };
  await render();
  await click('Update details');
  await type('Confirm account number', account.bankAccountNo!);
  mocks.profile = {
    approved: { ...account, bankAccountNo: '009876543210' },
    request: proposal('approved', 'newer-request'),
  };
  await act(async () => tree.update(<PayoutCard />));
  mocks.unwrap.mockRejectedValueOnce({
    status: 409,
    data: { message: 'Payout details have changed.' },
  });
  await submit();
  expect(mocks.submit).toHaveBeenCalledWith({
    payoutSubmission: expect.objectContaining({
      previousRequestId: 'old-request',
      bankAccountNo: account.bankAccountNo,
    }),
  });
  expect(mocks.failure).toHaveBeenCalledWith('Payout details have changed.');
  expect(mocks.refetch).toHaveBeenCalled();
  expect(tree.root.findAllByType('form')).toHaveLength(0);
});

test('prefills a rejected proposal and submits a corrected request linked to that decision', async () => {
  mocks.profile = { approved: null, request: proposal('rejected') };
  await render();
  expect(JSON.stringify(tree.toJSON())).toContain('Correct the name.');
  await click('Add details');
  expect(input('Account number').props.value).toBe(account.bankAccountNo);
  expect(input('Confirm account number').props.value).toBe('');
  await type('Account holder name', 'Corrected Name');
  await type('Confirm account number', account.bankAccountNo!);
  await submit();
  expect(mocks.submit).toHaveBeenCalledWith({
    payoutSubmission: expect.objectContaining({
      previousRequestId: 'old-request',
      bankAccountHolder: 'Corrected Name',
    }),
  });
  expect(mocks.success).toHaveBeenCalled();
  expect(tree.root.findAllByType('form')).toHaveLength(0);
});

test('clears account confirmation when cancelling and reopening the form', async () => {
  mocks.profile = { approved: account, request: proposal('approved') };
  await render();
  await click('Update details');
  await type('Confirm account number', account.bankAccountNo!);
  await click('Cancel');
  await click('Update details');
  expect(input('Confirm account number').props.value).toBe('');
  expect(mocks.submit).not.toHaveBeenCalled();
});
