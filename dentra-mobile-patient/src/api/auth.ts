import { useCallback } from 'react';
import {
  usePostAuthOtpRequestMutation,
  usePostAuthOtpVerifyMutation,
} from './generated/patient-api';

export function useRequestOtpMutation() {
  const [send, state] = usePostAuthOtpRequestMutation();
  const requestOtp = useCallback(
    (mobile: string) => send({ body: { mobile, purpose: 'patient' } }).unwrap(),
    [send],
  );
  return [requestOtp, state] as const;
}

export function useVerifyOtpMutation() {
  const [send, state] = usePostAuthOtpVerifyMutation();
  const verifyOtp = useCallback(
    (otpId: string, code: string, deviceId: string) =>
      send({ body: { otpId, code, deviceId } }).unwrap(),
    [send],
  );
  return [verifyOtp, state] as const;
}
