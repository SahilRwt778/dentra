export function formatPatientDate(value?: string | null) {
  if (!value) return 'Not provided';
  const date = new Date(
    value.length === 10 ? `${value}T12:00:00+05:30` : value,
  );
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
