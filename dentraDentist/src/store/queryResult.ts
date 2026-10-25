import axios from 'axios';
import { session } from '../features/auth/session';
import { errorMessage } from '../common/utils/api-error';

export type ApiError = { message: string; status?: number };

/** Keep the existing Axios endpoints, token rotation and cancellation in one place. */
export async function queryResult<T>(request: () => Promise<T>) {
  const version = session.getVersion();
  try {
    const data = await request();
    if (version !== session.getVersion())
      throw new axios.CanceledError('Session changed.');
    return { data };
  } catch (error) {
    // Axios errors contain request headers and native objects; store only a readable message.
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    return {
      error: {
        message: errorMessage(error),
        ...(status !== undefined ? { status } : {}),
      },
    };
  }
}
