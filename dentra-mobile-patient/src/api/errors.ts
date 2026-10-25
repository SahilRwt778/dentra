export function errorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const message = (error as { data?: { message?: unknown } } | undefined)?.data
    ?.message;
  if (typeof message === 'string') return message;
  if (error instanceof Error && error.message) return error.message;
  if (
    Array.isArray(message) &&
    message.every(value => typeof value === 'string')
  ) {
    return message.join('. ');
  }
  return fallback;
}
