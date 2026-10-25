export const WEEKDAYS = [
  { value: 1, label: 'Mon', name: 'Monday' },
  { value: 2, label: 'Tue', name: 'Tuesday' },
  { value: 3, label: 'Wed', name: 'Wednesday' },
  { value: 4, label: 'Thu', name: 'Thursday' },
  { value: 5, label: 'Fri', name: 'Friday' },
  { value: 6, label: 'Sat', name: 'Saturday' },
  { value: 0, label: 'Sun', name: 'Sunday' },
];
export function workingDaysLabel(days = [0, 1, 2, 3, 4, 5, 6]) {
  if (!days.length) return 'Closed every day';
  if (days.length === 7) return 'Every day';
  return WEEKDAYS.filter(day => days.includes(day.value))
    .map(day => day.label)
    .join(', ');
}
