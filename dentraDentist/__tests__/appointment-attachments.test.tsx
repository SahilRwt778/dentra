import { createStoreHarness } from '../test-utils/store';
import { testPatientRecord } from '../test-utils/patient';
import React from 'react';
import { Image, Modal, Text } from 'react-native';
import ReactTestRenderer, {
  act,
  type ReactTestRenderer as Renderer,
} from 'react-test-renderer';
import { AppointmentAttachments } from '../src/features/attachments/AppointmentAttachments';
import { AppointmentScreen } from '../src/features/appointments/AppointmentScreen';
import { appointmentsApi } from '../src/api/appointments.api';
import { patientFilesApi } from '../src/api/patient-files.api';
import { patientsApi } from '../src/api/patients.api';
import {
  openPrivatePdf,
  removePrivateFile,
} from '../src/common/services/private-files';
import { Button } from '../src/components/ui/Button';
import type { PatientFile } from '../src/common/types/api';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
  usePreventRemove: jest.fn(),
}));
jest.mock('../src/features/video/AppointmentVideoCard', () => ({
  AppointmentVideoCard: () => null,
}));
jest.mock('../src/api/appointments.api', () => ({
  appointmentsApi: { get: jest.fn(), start: jest.fn() },
}));

jest.mock('../src/api/patient-files.api', () => ({
  patientFilesApi: { list: jest.fn(), download: jest.fn() },
}));
jest.mock('../src/api/patients.api', () => ({
  patientsApi: { get: jest.fn() },
}));
jest.mock('../src/common/services/private-files', () => ({
  openPrivatePdf: jest.fn().mockResolvedValue(undefined),
  removePrivateFile: jest.fn().mockResolvedValue(undefined),
}));
const photo: PatientFile = {
  id: 'photo-one',
  appointmentId: 'visit-one',
  name: 'Patient photo.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2500,
  createdAt: '2026-10-18T10:00:00Z',
};
let renderer: Renderer;
let state: ReturnType<typeof createStoreHarness>;
async function flush() {
  for (let n = 0; n < 5; n++)
    await new Promise<void>(resolve => setImmediate(resolve));
}
async function mount() {
  await act(async () => {
    renderer = ReactTestRenderer.create(
      state.wrap(<AppointmentAttachments appointmentId="visit-one" />),
    );
    await flush();
  });
}
async function press(title: string) {
  await act(async () => {
    attachmentAction(title).props.onPress();
    await flush();
  });
}
function attachmentAction(title: string) {
  return (
    renderer.root
      .findAllByType(Button)
      .find(node => node.props.title === title) ??
    renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === title &&
        typeof node.props.onPress === 'function',
    )[0]
  );
}
function text() {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat()
    .join(' ');
}
beforeEach(() => {
  state = createStoreHarness();
  jest.clearAllMocks();
  jest.mocked(patientsApi.get).mockResolvedValue(testPatientRecord());
  jest.mocked(patientFilesApi.list).mockResolvedValue([photo]);
  jest
    .mocked(patientFilesApi.download)
    .mockResolvedValue('/private/cache/photo.jpg');
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  state.cleanup();
});

test('lists only the selected appointment attachments and opens a full photo from private cache', async () => {
  await mount();
  expect(patientFilesApi.list).toHaveBeenCalledWith(
    'visit-one',
    expect.any(AbortSignal),
  );
  expect(patientFilesApi.download).not.toHaveBeenCalled();
  await press('View photo');
  expect(patientFilesApi.download).toHaveBeenCalledWith(
    photo,
    expect.any(AbortSignal),
  );
  const image = renderer.root.findByType(Image);
  expect(image.props.source).toEqual({
    uri: 'file:///private/cache/photo.jpg',
  });
  expect(image.props.resizeMode).toBe('contain');
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  await act(async () =>
    renderer.root
      .findAll(node => typeof node.props.onPress === 'function')
      .find(node => node.props.accessibilityLabel === 'Close patient photo')!
      .props.onPress(),
  );
  expect(removePrivateFile).toHaveBeenCalledWith('/private/cache/photo.jpg');
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
});

test('Android back closes the image preview without leaving a private file behind', async () => {
  await mount();
  await press('View photo');
  await act(async () => renderer.root.findByType(Modal).props.onRequestClose());
  expect(removePrivateFile).toHaveBeenCalledWith('/private/cache/photo.jpg');
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
});

test('opens reports with the native PDF viewer and removes cached files on leaving the appointment', async () => {
  const pdf = {
    ...photo,
    id: 'report-one',
    name: 'Report.pdf',
    mimeType: 'application/pdf' as const,
  };
  jest.mocked(patientFilesApi.list).mockResolvedValue([pdf]);
  jest
    .mocked(patientFilesApi.download)
    .mockResolvedValue('/private/cache/report.pdf');
  await mount();
  await press('Open PDF report');
  expect(openPrivatePdf).toHaveBeenCalledWith('/private/cache/report.pdf');
  await act(async () => renderer.unmount());
  expect(removePrivateFile).toHaveBeenCalledWith('/private/cache/report.pdf');
});

test('a file arriving after unmount is removed and never opens a viewer', async () => {
  let finish!: (path: string) => void;
  jest.mocked(patientFilesApi.download).mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  jest
    .mocked(patientFilesApi.list)
    .mockResolvedValue([{ ...photo, mimeType: 'application/pdf' }]);
  await mount();
  await act(async () => attachmentAction('Open PDF report').props.onPress());
  await act(async () => renderer.unmount());
  await act(async () => {
    finish('/private/cache/late.pdf');
    await flush();
  });
  expect(removePrivateFile).toHaveBeenCalledWith('/private/cache/late.pdf');
  expect(openPrivatePdf).not.toHaveBeenCalled();
});

test('attachment failures show a retry action instead of claiming there are no files', async () => {
  jest
    .mocked(patientFilesApi.list)
    .mockRejectedValueOnce(new Error('Could not load files.'));
  await mount();
  expect(text()).toContain('Could not load files.');
  expect(text()).not.toContain('No files were shared');
  await press('Retry patient files');
  expect(text()).toContain(photo.name);
});

test('a photo that cannot decode closes the viewer and removes its private file', async () => {
  await mount();
  await press('View photo');
  await act(async () => renderer.root.findByType(Image).props.onError());
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  expect(removePrivateFile).toHaveBeenCalledWith('/private/cache/photo.jpg');
  expect(text()).toContain('Could not display this photo. Please try again.');
});

test('a delayed error from a closed photo cannot close the next preview', async () => {
  await mount();
  await press('View photo');
  const oldError = renderer.root.findByType(Image).props.onError;
  await act(async () => renderer.root.findByType(Modal).props.onRequestClose());
  jest
    .mocked(patientFilesApi.download)
    .mockResolvedValueOnce('/private/cache/new-photo.jpg');
  await press('View photo');
  await act(async () => oldError());
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  expect(renderer.root.findByType(Image).props.source.uri).toBe(
    'file:///private/cache/new-photo.jpg',
  );
  expect(removePrivateFile).not.toHaveBeenCalledWith(
    '/private/cache/new-photo.jpg',
  );
  expect(text()).not.toContain('Could not display this photo.');
});

test('opening a patient photo from appointment details does not produce duplicate React keys', async () => {
  const errors = jest.spyOn(console, 'error');
  jest.mocked(appointmentsApi.get).mockResolvedValue({
    id: 'visit-one',
    patientId: 'patient-one',
    patientName: 'Test Patient',
    patientAge: 30,
    patientGender: 'female',
    type: 'clinic',
    date: '2026-10-24',
    time: '10:00',
    status: 'in_consult',
    concern: 'Check-up',
    painScore: 0,
    swelling: false,
  });
  try {
    await act(async () => {
      renderer = ReactTestRenderer.create(
        state.wrap(
          <AppointmentScreen
            navigation={{} as never}
            route={{
              key: 'visit-one',
              name: 'Appointment',
              params: { appointmentId: 'visit-one' },
            }}
          />,
        ),
      );
      await flush();
    });
    await press('View photo');
    const duplicateKeys = errors.mock.calls.filter(call =>
      call.some(value =>
        String(value).includes('Encountered two children with the same key'),
      ),
    );
    expect(duplicateKeys).toHaveLength(0);
  } finally {
    errors.mockRestore();
  }
});
