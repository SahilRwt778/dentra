import { useContext } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useAppActive } from '@dentra/video/src/useAppActive';
import type { QueryOptions } from '@/api/types';
import { PushContext } from '@/notifications/push-context';

export function useAppointmentQueryOptions({
  awaitingPaymentConfirmation = false,
}: {
  awaitingPaymentConfirmation?: boolean;
} = {}): QueryOptions {
  const focused = useIsFocused();
  const active = useAppActive();
  const { state: pushState } = useContext(PushContext);
  const visible = focused && active;

  // Push invalidates appointment data. Poll only as a fallback, or while
  // waiting for a submitted payment to be confirmed by the gateway.
  let pollingInterval = 0;
  if (visible) {
    if (awaitingPaymentConfirmation) pollingInterval = 3000;
    else if (pushState !== 'enabled') pollingInterval = 15000;
  }
  return {
    skip: !visible,
    pollingInterval,
    refetchOnMountOrArgChange: true,
  };
}
