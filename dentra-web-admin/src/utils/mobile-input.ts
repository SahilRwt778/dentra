/** National digits for an Indian phone field; the API still receives +91. */
export function mobileInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  const includesCountryCode =
    value.trimStart().startsWith('+91') ||
    (digits.length === 12 && digits.startsWith('91'));
  return (includesCountryCode ? digits.slice(2) : digits).slice(0, 10);
}

export function isCompleteMobile(value: string): boolean {
  return /^\d{10}$/.test(value);
}
