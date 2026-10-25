import axios, { type InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from '../common/config/api';
import { session } from '../features/auth/session';

type SessionRequest = InternalAxiosRequestConfig & {
  sessionVersion?: number;
  retried?: boolean;
};
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});
api.interceptors.request.use((config: SessionRequest) => {
  if (!API_BASE_URL || (!__DEV__ && !API_BASE_URL.startsWith('https://'))) {
    throw new Error('Configure the HTTPS API URL in src/common/config/api.ts.');
  }
  if (
    config.sessionVersion !== undefined &&
    config.sessionVersion !== session.getVersion()
  ) {
    throw new axios.CanceledError('Session changed.');
  }
  config.sessionVersion = session.getVersion();
  const token = session.getAccessToken();
  if (!token) throw new axios.CanceledError('Please sign in again.');
  config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});
api.interceptors.response.use(
  response => {
    if (
      (response.config as SessionRequest).sessionVersion !==
      session.getVersion()
    ) {
      throw new axios.CanceledError('Session changed.');
    }
    return response;
  },
  async error => {
    const config = error.config as SessionRequest | undefined;
    if (!config || config.sessionVersion !== session.getVersion()) throw error;
    if (error.response?.status !== 401) throw error;
    if (config.retried) {
      await session.clear();
      throw error;
    }
    config.retried = true;
    // Concurrent 401s share one rotation. A late 401 can reuse the newer access token.
    if (
      config.headers.get('Authorization') ===
      `Bearer ${session.getAccessToken()}`
    ) {
      await session.refresh();
    }
    return api.request(config);
  },
);
