import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Renderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { PatientsPage } from '../src/pages/patients-page';
import { PatientRecordPage } from '../src/pages/patient-record-page';
import { ProfileAvatar } from '../src/components/profile-avatar';

const mocks = vi.hoisted(() => ({
  patient: {
    id: 'patient-one',
    fullName: 'Asha Mehra',
    profilePhotoUrl: '/profile-photos/patient/one?signature=synthetic' as
      string | null,
    chart: [],
    appointments: [],
  },
}));
vi.mock('../src/api/generated-api', () => ({
  useGetDentistsMePatientsQuery: () => ({
    data: [mocks.patient],
    isLoading: false,
  }),
  useGetDentistsMePatientsByPatientIdQuery: () => ({
    data: mocks.patient,
    isLoading: false,
  }),
}));
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  mocks.patient.profilePhotoUrl =
    '/profile-photos/patient/one?signature=synthetic';
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  vi.unstubAllGlobals();
});
test('uses the patient photo in the roster and patient record header', async () => {
  await act(async () => {
    tree = Renderer.create(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    );
  });
  expect(tree.root.findByType('img').props.src).toContain(
    mocks.patient.profilePhotoUrl,
  );
  await act(async () => {
    tree.update(
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<PatientRecordPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  expect(tree.root.findByType('img').props.src).toContain(
    mocks.patient.profilePhotoUrl,
  );
});
test('uses initials when a photo is missing or fails and displays a replacement photo', async () => {
  await act(async () => {
    tree = Renderer.create(<ProfileAvatar name="Asha Mehra" />);
  });
  expect(tree.root.findByType('span').children).toEqual(['AM']);
  await act(async () => {
    tree.update(
      <ProfileAvatar name="Asha Mehra" photoUrl="/profile-photos/first" />,
    );
  });
  await act(async () => tree.root.findByType('img').props.onError());
  expect(tree.root.findAllByType('img')).toHaveLength(0);
  expect(tree.root.findByType('span').children).toEqual(['AM']);
  await act(async () => {
    tree.update(
      <ProfileAvatar name="Asha Mehra" photoUrl="/profile-photos/replaced" />,
    );
  });
  expect(tree.root.findByType('img').props.src).toContain(
    '/profile-photos/replaced',
  );
});
