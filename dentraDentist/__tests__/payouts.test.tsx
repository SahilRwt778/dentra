import React from 'react';
import { Text, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createStoreHarness } from '../test-utils/store';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { dentraApi } from '../src/store/dentraApi';
import { PayoutDetailsScreen } from '../src/features/settings/PayoutDetailsScreen';
import { Button } from '../src/components/ui/Button';
import type {
  PayoutDetails,
  PayoutProfile,
  PayoutRequest,
  PayoutSubmission,
} from '../src/common/types/settings';

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
const account: PayoutDetails = {
  bankAccountHolder: 'Synthetic Dentist',
  bankAccountNo: '001234567890',
  bankIfsc: 'HDFC0001234',
  pan: 'ABCDE1234F',
  gstin: null,
};
function request(
  status: PayoutRequest['status'],
  id = 'request-one',
): PayoutRequest {
  return {
    ...account,
    id,
    dentistId: 'synthetic-dentist',
    status,
    submittedAt: '2026-10-23T09:00:00.000Z',
    reviewedAt: null,
    rejectionReason: null,
  };
}
let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer | undefined;
let profile: PayoutProfile;
let submissions: PayoutSubmission[];
let beforeSubmit: (() => Promise<void>) | undefined;
let loseNextResponse: boolean;
let sequence: number;
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
function conflict(config: InternalAxiosRequestConfig, message: string): never {
  throw new AxiosError('Conflict', 'ERR_BAD_RESPONSE', config, undefined, {
    ...reply(config, { message }),
    status: 409,
  });
}
async function flush() {
  for (let index = 0; index < 8; index++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    tree = Renderer.create(state.wrap(<PayoutDetailsScreen />));
    await flush();
  });
}
function text() {
  return tree!.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');
}
async function press(title: string) {
  await act(async () => {
    await tree!.root
      .findAllByType(Button)
      .find(node => node.props.title === title)!
      .props.onPress();
    await flush();
  });
}
async function type(label: string, value: string) {
  await act(async () =>
    tree!.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === label)!
      .props.onChangeText(value),
  );
}
async function fill() {
  await type('Account holder name', account.bankAccountHolder!);
  await type('Account number', account.bankAccountNo!);
  await type('Confirm account number', account.bankAccountNo!);
  await type('IFSC', 'hdfc0001234');
  await type('PAN', 'abcde1234f');
}
beforeEach(async () => {
  await session.signIn({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  state = createStoreHarness();
  tree = undefined;
  profile = { approved: null, request: null };
  submissions = [];
  beforeSubmit = undefined;
  loseNextResponse = false;
  sequence = 0;
  api.defaults.adapter = async config => {
    if (config.method === 'get')
      return reply(config, JSON.parse(JSON.stringify(profile)));
    const details = JSON.parse(config.data) as PayoutSubmission;
    submissions.push(details);
    if (beforeSubmit) await beforeSubmit();
    if (profile.request?.status === 'pending')
      conflict(config, 'A payout request is already awaiting admin review.');
    if (details.previousRequestId !== (profile.request?.id ?? null))
      conflict(
        config,
        'Payout details have changed. Refresh before submitting again.',
      );
    profile.request = {
      ...request('pending', `request-${++sequence}`),
      bankAccountHolder: details.bankAccountHolder,
      bankAccountNo: details.bankAccountNo,
      bankIfsc: details.bankIfsc,
      pan: details.pan,
      gstin: details.gstin,
    };
    if (loseNextResponse) {
      loseNextResponse = false;
      throw new AxiosError('Response lost', 'ERR_NETWORK', config);
    }
    return { ...reply(config, profile.request), status: 201 };
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  state.cleanup();
  await session.clear();
});

test('validates confirmation before sending normalized details through Axios and Redux', async () => {
  await mount();
  await press('Add payout details');
  await fill();
  await type('Confirm account number', '9999999999');
  await press('Submit for approval');
  expect(submissions).toHaveLength(0);
  expect(text()).toContain('Account numbers do not match.');
  await type('Confirm account number', account.bankAccountNo!);
  await press('Submit for approval');
  expect(submissions).toEqual([
    {
      ...account,
      confirmAccountNo: account.bankAccountNo,
      previousRequestId: null,
    },
  ]);
  expect(text()).toContain('Awaiting admin approval');
  expect(tree!.root.findAllByType(TextInput)).toHaveLength(0);
  expect(JSON.stringify(state.store.getState())).not.toContain(
    'confirmAccountNo',
  );
});

test('refreshes an admin approval and keeps the approved account visible while an update is pending', async () => {
  profile.request = request('pending');
  await mount();
  profile = { approved: account, request: request('approved') };
  await press('Refresh status');
  expect(text()).toContain('Approved payout account');
  await press('Update payout details');
  await type('Account number', '009876543210');
  await type('Confirm account number', '009876543210');
  await press('Submit for approval');
  expect(text()).toContain('Approved payout account');
  expect(text()).toContain('Awaiting admin approval');
  expect(text()).toContain(account.bankAccountNo);
  expect(text()).toContain('009876543210');
  expect(profile.approved).toEqual(account);
  expect(submissions[0].previousRequestId).toBe('request-one');
});

test('shows rejection reasons and corrects the rejected proposal with a fresh confirmation', async () => {
  profile = {
    approved: account,
    request: {
      ...request('rejected'),
      bankAccountNo: '009876543210',
      rejectionReason: 'Correct the account holder name.',
    },
  };
  await mount();
  expect(text()).toContain('Correct the account holder name.');
  await press('Update and resubmit');
  expect(
    tree!.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Account number')!.props
      .value,
  ).toBe('009876543210');
  expect(
    tree!.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Confirm account number')!
      .props.value,
  ).toBe('');
  await type('Account holder name', 'Corrected Synthetic Name');
  await type('Confirm account number', '009876543210');
  await press('Submit for approval');
  expect(submissions[0]).toMatchObject({
    previousRequestId: 'request-one',
    bankAccountHolder: 'Corrected Synthetic Name',
  });
  expect(text()).toContain('Awaiting admin approval');
  expect(profile.approved).toEqual(account);
});

test('a stale form cannot silently use the version from a more recent admin decision', async () => {
  profile = { approved: account, request: request('approved') };
  await mount();
  await press('Update payout details');
  await type('Confirm account number', account.bankAccountNo!);
  profile = {
    approved: { ...account, bankAccountNo: '005555555555' },
    request: request('approved', 'newer-request'),
  };
  await press('Submit for approval');
  expect(submissions[0].previousRequestId).toBe('request-one');
  expect(text()).toContain('Payout details have changed.');
  expect(text()).toContain('005555555555');
  expect(tree!.root.findAllByType(TextInput)).toHaveLength(0);
});

test('a lost submission response can be retried without creating a second pending request', async () => {
  await mount();
  await press('Add payout details');
  await fill();
  loseNextResponse = true;
  await press('Submit for approval');
  expect(text()).toContain('Cannot reach Dentra.');
  expect(tree!.root.findAllByType(TextInput)).toHaveLength(6);
  await press('Submit for approval');
  expect(sequence).toBe(1);
  expect(text()).toContain('Awaiting admin approval');
  expect(tree!.root.findAllByType(TextInput)).toHaveLength(0);
});

test('rapid duplicate taps produce one request', async () => {
  await mount();
  await press('Add payout details');
  await fill();
  let release!: () => void;
  beforeSubmit = () =>
    new Promise<void>(resolve => {
      release = resolve;
    });
  let first!: Promise<void>;
  await act(async () => {
    const save = tree!.root
      .findAllByType(Button)
      .find(node => node.props.title === 'Submit for approval')!.props.onPress;
    first = save();
    save();
    await flush();
  });
  expect(submissions).toHaveLength(1);
  await act(async () => {
    release();
    await first;
    await flush();
  });
  expect(text()).toContain('Awaiting admin approval');
});

test('cancelling discards account confirmation and private query cache is removed after leaving', async () => {
  profile = { approved: account, request: request('approved') };
  await mount();
  await press('Update payout details');
  await type('Confirm account number', account.bankAccountNo!);
  await press('Cancel');
  await press('Update payout details');
  expect(
    tree!.root
      .findAllByType(TextInput)
      .find(node => node.props.accessibilityLabel === 'Confirm account number')!
      .props.value,
  ).toBe('');
  await act(async () => {
    tree!.unmount();
    tree = undefined;
  });
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 20));
  });
  expect(
    dentraApi.endpoints.getPayoutProfile.select()(state.store.getState()).data,
  ).toBeUndefined();
  expect(JSON.stringify(state.store.getState())).not.toContain(
    account.bankAccountNo,
  );
});
