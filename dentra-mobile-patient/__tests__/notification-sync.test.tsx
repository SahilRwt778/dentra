import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { useNotificationSync } from '../src/hooks/use-notification-sync';

const mockDispatch = jest.fn();
const mockQuery = jest.fn();
const mockInvalidate = jest.fn(tags => ({ type: 'invalidate', payload: tags }));
let mockData = { items: [{ id: 'initial' }] };
jest.mock('../src/store/hooks', () => ({ useAppDispatch: () => mockDispatch }));
jest.mock('../src/api/generated/patient-api', () => ({
  useGetNotificationsQuery: (...args: unknown[]) => {
    mockQuery(...args);
    return { data: mockData };
  },
  dentraApi: {
    util: { invalidateTags: (...args: unknown[]) => mockInvalidate(args[0]) },
  },
}));
function Bridge() {
  useNotificationSync();
  return null;
}

test('pauses in the background, resumes on return and refreshes appointments for newly received events', async () => {
  let stateChanged: (state: AppStateStatus) => void = () => undefined;
  const remove = jest.fn();
  const subscription = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_event, listener) => {
      stateChanged = listener;
      return { remove };
    });
  let tree: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = Renderer.create(<Bridge />);
    });
    expect(mockDispatch).not.toHaveBeenCalled();
    await act(async () => stateChanged('background'));
    expect(mockQuery).toHaveBeenLastCalledWith(
      {},
      expect.objectContaining({ skip: true }),
    );
    await act(async () => stateChanged('active'));
    expect(mockQuery).toHaveBeenLastCalledWith(
      {},
      expect.objectContaining({
        skip: false,
        pollingInterval: 10000,
        refetchOnMountOrArgChange: true,
      }),
    );
    mockData = { items: [{ id: 'new' }, { id: 'initial' }] };
    await act(async () => tree!.update(<Bridge />));
    expect(mockInvalidate).toHaveBeenCalledWith([
      'Appointments',
      'Consultations',
      'Patients',
    ]);
    await act(async () => tree!.update(<Bridge />));
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    await act(async () => tree!.unmount());
    expect(remove).toHaveBeenCalled();
  } finally {
    subscription.mockRestore();
  }
});
