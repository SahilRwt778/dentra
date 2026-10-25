import React from 'react';
import { Switch, TextInput } from 'react-native';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import type { InternalAxiosRequestConfig } from 'axios';
import { createStoreHarness } from '../test-utils/store';
import { api } from '../src/api/client';
import { session } from '../src/features/auth/session';
import { ProfileScreen } from '../src/features/profile/ProfileScreen';
import { EditProfileScreen } from '../src/features/settings/EditProfileScreen';
import { EditClinicScreen } from '../src/features/settings/EditClinicScreen';
import { ConsultationSettingsScreen } from '../src/features/settings/ConsultationSettingsScreen';
import { TimeField } from '../src/components/forms/TimeField';
import { Button } from '../src/components/ui/Button';
import type { Dentist } from '../src/common/types/api';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockDentist: Dentist;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('../src/features/auth/DentistGate', () => ({
  useDentist: () => mockDentist,
}));
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({ signOut: jest.fn() }),
}));
jest.mock('../src/features/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

let state: ReturnType<typeof createStoreHarness>;
let tree: ReactTestRenderer | undefined;
let writes: { url: string; body: Record<string, unknown>; method: string }[];
const navigation = { goBack: mockGoBack, navigate: mockNavigate } as never;
function reply(config: InternalAxiosRequestConfig, data: unknown) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}
async function flush() {
  for (let index = 0; index < 8; index++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount(screen: React.ReactNode) {
  await act(async () => {
    tree = Renderer.create(state.wrap(screen));
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
async function press(title: string) {
  await act(async () => {
    await tree!.root
      .findAllByType(Button)
      .find(node => node.props.title === title)!
      .props.onPress();
    await flush();
  });
}
async function pressLabel(label: string) {
  const target = tree!.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  )[0];
  expect(target).toBeDefined();
  await act(async () => target.props.onPress());
}
beforeEach(async () => {
  jest.clearAllMocks();
  await session.signIn({
    accessToken: 'synthetic-access',
    refreshToken: 'synthetic-refresh',
    expiresInSeconds: 900,
  });
  state = createStoreHarness();
  tree = undefined;
  writes = [];
  mockDentist = {
    id: 'test-dentist',
    fullName: 'Synthetic Dentist',
    mobile: '+919999999999',
    email: 'test@example.test',
    status: 'verified',
    qualification: 'BDS',
    specialization: 'General dentistry',
    councilRegNo: 'TEST-REG',
    yearsExperience: 5,
    languages: ['English'],
    offersVideo: true,
    feeVideoPaise: 1000,
    feeClinicPaise: 2000,
    videoWorkingDays: [1, 2, 3, 4, 5],
    videoHoursFrom: '09:00',
    videoHoursTo: '18:00',
    documents: [],
    clinics: [
      {
        id: 'test-clinic',
        name: 'Test clinic',
        addressLine: 'Test address',
        pincode: '110001',
        phone: '+918888888888',
        workingDays: [1, 3, 5],
        hoursFrom: '09:00',
        hoursTo: '18:30',
      },
    ],
  };
  api.defaults.adapter = async config => {
    if (config.method === 'get') {
      if (config.url === '/dentists/me/clinics')
        return reply(config, mockDentist.clinics);
      if (config.url === '/dentists/me/payout-details')
        return reply(config, { approved: null, request: null });
      return reply(config, mockDentist);
    }
    const body = JSON.parse(config.data);
    writes.push({ url: config.url!, body, method: config.method! });
    if (config.url === '/dentists/me') {
      mockDentist = { ...mockDentist, ...body };
      return reply(config, mockDentist);
    }
    return reply(config, { ...mockDentist.clinics[0], ...body });
  };
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  state.cleanup();
  await session.clear();
});

test('the prototype-style Profile card links to each settings screen and saves the separate video switch', async () => {
  await mount(<ProfileScreen />);
  for (const [label, destination] of [
    ['Edit Profile', 'EditProfile'],
    ['Manage Locations', 'Clinics'],
    ['Edit Fees and hours', 'ConsultationSettings'],
    ['Manage Payout details', 'PayoutDetails'],
    ['Manage Time off', 'TimeOff'],
    ['View Payments', 'Payments'],
    ['Open Wallet', 'Wallet'],
  ]) {
    await pressLabel(label);
    expect(mockNavigate).toHaveBeenLastCalledWith(destination);
  }
  await act(async () => {
    await tree!.root.findByType(Switch).props.onValueChange(false);
    await flush();
  });
  expect(writes).toEqual([
    { url: '/dentists/me', method: 'patch', body: { offersVideo: false } },
  ]);
});

test('edits the supported profile fields without changing the login mobile number', async () => {
  await mount(
    <EditProfileScreen
      navigation={navigation}
      route={{ key: 'edit', name: 'EditProfile' }}
    />,
  );
  await type('Email', 'not-an-email');
  await press('Save changes');
  expect(writes).toHaveLength(0);
  await type('Email', 'updated@example.test');
  await type('Languages', 'English, Hindi, ,');
  await press('Save changes');
  expect(writes[0]).toEqual({
    url: '/dentists/me',
    method: 'patch',
    body: {
      qualification: 'BDS',
      specialization: 'General dentistry',
      councilRegNo: 'TEST-REG',
      email: 'updated@example.test',
      languages: ['English', 'Hindi'],
    },
  });
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

test('editing only a clinic name preserves its address, PIN code, phone and hours', async () => {
  await mount(
    <EditClinicScreen
      navigation={navigation}
      route={{
        key: 'clinic',
        name: 'EditClinic',
        params: { clinicId: 'test-clinic' },
      }}
    />,
  );
  await type('Clinic name', 'Renamed clinic');
  await press('Save clinic');
  expect(writes[0]).toEqual({
    url: '/dentists/me/clinics/test-clinic',
    method: 'patch',
    body: {
      name: 'Renamed clinic',
      addressLine: 'Test address',
      pincode: '110001',
      phone: '+918888888888',
      hoursFrom: '09:00',
      hoursTo: '18:30',
      workingDays: [1, 3, 5],
    },
  });
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

test('adding a clinic calls the signed-in dentist endpoint', async () => {
  await mount(
    <EditClinicScreen
      navigation={navigation}
      route={{ key: 'add', name: 'EditClinic' }}
    />,
  );
  await type('Clinic name', 'New clinic');
  await press('Save clinic');
  expect(writes[0]).toMatchObject({
    url: '/dentists/me/clinics',
    method: 'post',
    body: { name: 'New clinic', hoursFrom: '10:00', hoursTo: '18:30' },
  });
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

test('saves fractional fees as exact integer paise and omits video hours when disabled', async () => {
  await mount(
    <ConsultationSettingsScreen
      navigation={navigation}
      route={{ key: 'fees', name: 'ConsultationSettings' }}
    />,
  );
  await type('In-clinic fee (₹)', '0.29');
  await type('Video consultation fee (₹)', '10.01');
  await act(async () =>
    tree!.root.findByType(Switch).props.onValueChange(false),
  );
  await press('Save changes');
  expect(writes[0].body).toEqual({
    feeClinicPaise: 29,
    feeVideoPaise: 1001,
    offersVideo: false,
    videoWorkingDays: [1, 2, 3, 4, 5],
  });
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});

test('the time sheet applies a selection only when confirmed', async () => {
  const changed = jest.fn();
  await mount(<TimeField label="Opens at" value="10:00" onChange={changed} />);
  await pressLabel('Opens at, 10:00 AM');
  await pressLabel('Hour 09');
  await pressLabel('Minute 15');
  await press('Cancel');
  expect(changed).not.toHaveBeenCalled();
  await pressLabel('Opens at, 10:00 AM');
  await pressLabel('Hour 09');
  await pressLabel('Minute 15');
  await press('Set time');
  expect(changed).toHaveBeenCalledWith('09:15');
});

test('saves separate weekday choices for video consultations and a clinic', async () => {
  await mount(
    <ConsultationSettingsScreen
      navigation={navigation}
      route={{ key: 'days', name: 'ConsultationSettings' }}
    />,
  );
  await pressLabel('Monday');
  await pressLabel('Sunday');
  await press('Save changes');
  expect(writes[0].body.videoWorkingDays).toEqual([0, 2, 3, 4, 5]);
  await act(async () => tree?.unmount());
  await mount(
    <EditClinicScreen
      navigation={navigation}
      route={{
        key: 'clinic-days',
        name: 'EditClinic',
        params: { clinicId: 'test-clinic' },
      }}
    />,
  );
  await pressLabel('Wednesday');
  await press('Save clinic');
  expect(writes.at(-1)!.body.workingDays).toEqual([1, 5]);
});
