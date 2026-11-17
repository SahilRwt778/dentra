import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useUpdatePatientMutation } from '../src/api/patients';

const mockSend = jest.fn();
jest.mock('../src/api/generated/patient-api', () => ({
  usePatchPatientsMeMutation: () => [mockSend, { isLoading: false }],
}));
let tree: Renderer.ReactTestRenderer;
let update: ReturnType<typeof useUpdatePatientMutation>[0];
function Form() {
  [update] = useUpdatePatientMutation();
  return null;
}
beforeEach(async () => {
  jest.clearAllMocks();
  mockSend.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  await act(async () => {
    tree = Renderer.create(<Form />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('uses native multipart file descriptors for photo updates and preserves edited details', async () => {
  const photo = {
    uri: 'file:///profile.png',
    name: 'profile.png',
    type: 'image/png',
  };
  await update({ city: 'Delhi' }, photo);
  const body = mockSend.mock.calls[0][0].patientUpdate as FormData;
  expect(body).toBeInstanceOf(FormData);
  const parts = body.getParts();
  expect(parts.find(part => part.fieldName === 'details')?.string).toBe(
    '{"city":"Delhi"}',
  );
  expect(parts.find(part => part.fieldName === 'profilePhoto')).toMatchObject({
    fieldName: 'profilePhoto',
    uri: photo.uri,
    name: photo.name,
    type: photo.type,
  });
});

test('keeps no-file profile saves and photo removal as JSON', async () => {
  await update({ fullName: 'Updated Patient' });
  await update({ removeProfilePhoto: true });
  expect(mockSend.mock.calls.map(([body]) => body)).toEqual([
    { patientUpdate: { fullName: 'Updated Patient' } },
    { patientUpdate: { removeProfilePhoto: true } },
  ]);
});
