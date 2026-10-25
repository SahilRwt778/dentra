export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { data?: { message?: string | string[] } })?.data
    ?.message;
  return Array.isArray(message) ? message.join('. ') : message || fallback;
}
