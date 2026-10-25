import { publicHttp } from './http';
import { getDeviceId } from '../common/services/secure-storage';
import type { AuthTokens, OtpChallenge } from '../common/types/api';

export const authApi = {
  async requestOtp(mobile: string) {
    const { data } = await publicHttp.post<OtpChallenge>('/auth/otp/request', {
      mobile,
      purpose: 'dentist',
    });
    return data;
  },
  async verifyOtp(otpId: string, code: string) {
    const deviceId = await getDeviceId();
    const { data } = await publicHttp.post<AuthTokens>('/auth/otp/verify', {
      otpId,
      code,
      deviceId,
    });
    return data;
  },
};
