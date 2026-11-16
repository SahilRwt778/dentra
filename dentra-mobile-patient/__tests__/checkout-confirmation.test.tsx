import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useBookAppointment } from '../src/hooks/use-book-appointment';
import { openCheckout } from '../src/lib/checkout';
import type { Appointment, BookAppointment } from '../src/api/types';

const mockBook = jest.fn();
const mockRefreshPayment = jest.fn();
jest.mock('../src/api/appointments', () => ({
  useBookAppointmentMutation: () => [mockBook],
  useRefreshAppointmentPayment: () => mockRefreshPayment,
}));
jest.mock('../src/lib/checkout', () => ({ openCheckout: jest.fn() }));

let booking: ReturnType<typeof useBookAppointment>;
let tree: Renderer.ReactTestRenderer;
function Harness() {
  booking = useBookAppointment();
  return null;
}
const appointment: Appointment = {
  id: 'synthetic-booking',
  status: 'booked',
  payment: { status: 'pending', amountPaise: 50000 },
};
const details: Omit<BookAppointment, 'idempotencyKey'> = {
  dentistId: 'synthetic-dentist',
  type: 'video',
  date: '2099-01-01',
  time: '10:00',
  concern: 'Synthetic test',
  paymentMethod: 'card',
};
beforeEach(async () => {
  jest.resetAllMocks();
  mockBook.mockResolvedValue(appointment);
  (openCheckout as jest.Mock).mockResolvedValue({});
  await act(async () => {
    tree = Renderer.create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

test('a new booking returns the server-confirmed payment immediately after checkout', async () => {
  mockRefreshPayment.mockResolvedValue({
    ...appointment,
    payment: { ...appointment.payment, status: 'paid' },
  });
  let result;
  await act(async () => {
    result = await booking.submit(details);
  });
  expect(mockRefreshPayment).toHaveBeenCalledWith(appointment.id);
  expect(result).toMatchObject({
    appointment: { payment: { status: 'paid' } },
    paymentSubmitted: true,
    paymentCancelled: false,
  });
});

test('a failed server check preserves successful checkout as awaiting confirmation', async () => {
  mockRefreshPayment.mockRejectedValue({ status: 'FETCH_ERROR' });
  let result;
  await act(async () => {
    result = await booking.submit(details);
  });
  expect(result).toMatchObject({
    appointment: { payment: { status: 'pending' } },
    paymentSubmitted: true,
    paymentCancelled: false,
  });
});

test('dismissing checkout leaves payment available to retry and never claims it was submitted', async () => {
  (openCheckout as jest.Mock).mockRejectedValue({
    code: 0,
    description: 'Cancelled',
  });
  let result;
  await act(async () => {
    result = await booking.submit(details);
  });
  expect(mockRefreshPayment).not.toHaveBeenCalled();
  expect(result).toMatchObject({
    paymentSubmitted: false,
    paymentCancelled: true,
  });
});
