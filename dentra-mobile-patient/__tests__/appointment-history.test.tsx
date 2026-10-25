import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useAppointments } from '../src/hooks/use-appointments';

const mockLoad = jest.fn();
const mockFirst = {
  data: { items: [{ id: 'new-visit' }], nextPage: 2 },
  fulfilledTimeStamp: 1,
  isLoading: false,
  isFetching: false,
  refetch: jest.fn(),
};
jest.mock('../src/api/generated/patient-api', () => ({
  useGetAppointmentsQuery: () => mockFirst,
  useLazyGetAppointmentsQuery: () => [mockLoad],
}));

test('refresh retries a failed history page even when the first page has not changed', async () => {
  let result: ReturnType<typeof useAppointments>;
  function History() {
    result = useAppointments();
    return null;
  }
  mockLoad
    .mockReturnValueOnce({
      unwrap: async () => {
        throw new Error('Network interrupted');
      },
    })
    .mockReturnValueOnce({
      unwrap: async () => ({ items: [{ id: 'older-visit' }], nextPage: null }),
    });
  let tree: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = Renderer.create(<History />);
    });
    expect(result!.error).toBeInstanceOf(Error);
    mockFirst.fulfilledTimeStamp = 2;
    await act(async () => tree!.update(<History />));
    expect(result!.error).toBeUndefined();
    expect(result!.items.map(item => item.id)).toEqual([
      'new-visit',
      'older-visit',
    ]);
    expect(mockLoad).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => tree?.unmount());
  }
});
