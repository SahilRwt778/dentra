import { createStoreHarness } from '../test-utils/store';
import React from 'react';
import { Text, TextInput, View } from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import App from '../App';
import { session } from '../src/features/auth/session';
import { api } from '../src/api/client';
import { publicHttp } from '../src/api/http';
import { Button } from '../src/components/ui/Button';
import { chooseDocument } from '../src/common/services/document-picker';
import { DentistGate } from '../src/features/auth/DentistGate';
import { AuthProvider } from '../src/features/auth/AuthProvider';
import type { Dentist, DentistStatus } from '../src/common/types/api';

jest.mock('../src/navigation/StackNavigator', () => {
  const mockReact = require('react');
  const { View: MockView } = require('react-native');
  return {
    StackNavigator: () =>
      mockReact.createElement(MockView, { testID: 'verified-portal' }),
  };
});
// Gate tests exercise the real root flow; native navigation and inbox UI have separate checks.
jest.mock('@react-navigation/native', () => ({
  DefaultTheme: { colors: {} },
  NavigationContainer: ({ children }: { children: React.ReactNode }) =>
    children,
  useNavigationContainerRef: () => ({ isReady: () => false }),
}));
jest.mock('../src/features/notifications/NotificationsProvider', () => ({
  NotificationsProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useNotifications: () => ({ notice: null }),
}));
jest.mock('../src/common/services/document-picker', () => ({
  chooseDocument: jest.fn(),
}));
const tokens = {
  accessToken: 'test-access',
  refreshToken: 'test-refresh',
  expiresInSeconds: 900,
};
const base: Dentist = {
  id: 'dentist-one',
  fullName: 'Dentist One',
  mobile: '+919999000001',
  status: 'pending_review',
  qualification: 'BDS',
  specialization: 'General Dentist',
  councilRegNo: 'SDC-1',
  yearsExperience: 3,
  languages: ['English'],
  offersVideo: true,
  feeVideoPaise: 50000,
  feeClinicPaise: 60000,
  clinics: [
    {
      id: 'clinic-one',
      name: 'Sample clinic',
      hoursFrom: '10:00',
      hoursTo: '18:00',
    },
  ],
  documents: [],
};
let renderer: Renderer;
let state: ReturnType<typeof createStoreHarness>;
function text() {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');
}
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
async function flush() {
  for (let n = 0; n < 6; n++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(node: React.ReactElement) {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      node.type === App ? node : state.wrap(node),
    );
    await flush();
  });
}
async function press(title: string) {
  await act(async () => {
    renderer.root
      .findAllByType(Button)
      .find(node => node.props.title === title)!
      .props.onPress();
    await flush();
  });
}
beforeEach(async () => {
  state = createStoreHarness();
  await session.clear();
  jest.clearAllMocks();
  publicHttp.defaults.adapter = async config => reply(config, tokens);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  state.cleanup();
  await session.clear();
});

test('new sign-in validates mobile and submits a real four-digit dentist OTP', async () => {
  const calls: InternalAxiosRequestConfig[] = [];
  publicHttp.defaults.adapter = async config => {
    calls.push(config);
    return reply(
      config,
      config.url?.endsWith('request')
        ? { otpId: 'otp-one', expiresInSeconds: 300, resendAfterSeconds: 30 }
        : tokens,
    );
  };
  api.defaults.adapter = async config => reply(config, base);
  await mount(<App appStore={state.store} />);
  await press('Send verification code');
  expect(text()).toContain('Enter a 10-digit mobile number.');
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'phone-input' })
      .props.onChangeText('9999000001'),
  );
  await press('Send verification code');
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'otp-input' })
      .props.onChangeText('12ab345'),
  );
  expect(renderer.root.findByProps({ testID: 'otp-input' }).props.value).toBe(
    '1234',
  );
  await press('Verify and continue');
  expect(JSON.parse(calls[0].data)).toEqual({
    mobile: '+919999000001',
    purpose: 'dentist',
  });
  expect(JSON.parse(calls[1].data)).toMatchObject({
    otpId: 'otp-one',
    code: '1234',
  });
  expect(text()).toContain('Waiting for admin verification');
  expect(
    renderer.root
      .findAllByType(View)
      .filter(node => node.props.testID === 'verified-portal'),
  ).toHaveLength(0);
});

test.each<DentistStatus>([
  'pending_review',
  'rejected',
  'disabled',
  'verified',
])('account gate handles %s without exposing protected tabs', async status => {
  await session.signIn(tokens);
  api.defaults.adapter = async config =>
    reply(config, {
      ...base,
      status,
      rejectionReason: 'Registration could not be verified.',
    });
  await mount(
    <AuthProvider>
      <DentistGate>
        <View testID="protected-content" />
      </DentistGate>
    </AuthProvider>,
  );
  expect(
    renderer.root
      .findAllByType(View)
      .filter(node => node.props.testID === 'protected-content'),
  ).toHaveLength(status === 'verified' ? 1 : 0);
  if (status === 'rejected')
    expect(text()).toContain('Registration could not be verified.');
  if (status === 'disabled') expect(text()).toContain('Account disabled');
});

test('an approved application opens the portal after a status refresh', async () => {
  await session.signIn(tokens);
  let status: DentistStatus = 'pending_review';
  api.defaults.adapter = async config => reply(config, { ...base, status });
  await mount(<App appStore={state.store} />);
  expect(text()).toContain('Waiting for admin verification');
  status = 'verified';
  await press('Check application status');
  expect(
    renderer.root
      .findAllByType(View)
      .filter(node => node.props.testID === 'verified-portal'),
  ).toHaveLength(1);
});

test('new applicant saves details and all required documents before admin submission', async () => {
  await session.signIn(tokens);
  let draft: Dentist | null = null;
  const calls: string[] = [];
  api.defaults.adapter = async config => {
    calls.push(`${config.method} ${config.url}`);
    if (config.url === '/dentists/me') {
      if (draft) return reply(config, draft);
      throw new AxiosError('No profile', undefined, config, undefined, {
        ...reply(config, {}),
        status: 404,
      });
    }
    if (config.url === '/dentists/applications') {
      draft = { ...base, status: 'draft' };
      return reply(config, draft);
    }
    if (config.url?.endsWith('/documents'))
      return reply(config, { id: 'doc-one' });
    if (config.url?.endsWith('/submit')) {
      draft = { ...base, status: 'pending_review' };
      return reply(config, draft);
    }
    return reply(config, draft);
  };
  jest.mocked(chooseDocument).mockResolvedValue({
    uri: 'file:///private/sample.jpg',
    name: 'sample.jpg',
    type: 'image/jpeg',
    size: 100,
  });
  await mount(<App appStore={state.store} />);
  const setField = async (label: string, value: string) =>
    act(async () => {
      renderer.root
        .findAllByType(TextInput)
        .find(input => input.props.accessibilityLabel === label)!
        .props.onChangeText(value);
    });
  await setField('Full name', 'Dentist One');
  await setField('Qualification', 'BDS');
  await setField('Dental Council registration number', 'SDC-1');
  await setField('Primary clinic name and address', 'Sample clinic');
  await act(async () =>
    renderer.root
      .findAllByProps({ accessibilityRole: 'checkbox' })[0]
      .props.onPress(),
  );
  await press('Submit application to admin');
  expect(text()).toContain('Add required documents:');
  expect(calls.some(call => call.startsWith('post'))).toBe(false);
  for (const label of [
    'degree certificate (bds / mds)',
    'dental council registration',
    'government photo id',
    'selfie photo',
  ])
    await press(`Add ${label}`);
  await press('Submit application to admin');
  expect(calls.filter(call => call.endsWith('/documents'))).toHaveLength(4);
  expect(
    calls.indexOf('post /dentists/applications/me/submit'),
  ).toBeGreaterThan(
    calls.lastIndexOf('post /dentists/applications/dentist-one/documents'),
  );
  expect(text()).toContain('Waiting for admin verification');
});
