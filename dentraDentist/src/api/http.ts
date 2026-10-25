import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT_MS } from '../common/config/api';

// Public auth calls must not run through the refresh interceptor.
export const publicHttp = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
});
publicHttp.interceptors.request.use(config => {
  if (!API_BASE_URL || (!__DEV__ && !API_BASE_URL.startsWith('https://'))) {
    throw new Error('Configure the HTTPS API URL in src/common/config/api.ts.');
  }
  return config;
});
