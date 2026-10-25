import axios from 'axios';

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(' ');
    if (!error.response)
      return 'Cannot reach Dentra. Check your connection and try again.';
    if (error.response.status === 401)
      return 'Your session expired. Please sign in again.';
    return 'Could not complete the request. Please try again.';
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message;
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.';
}
