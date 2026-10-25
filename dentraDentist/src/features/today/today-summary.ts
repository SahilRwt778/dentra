import type { Appointment } from '../../common/types/api';

export function todaySummary(appointments: Appointment[]) {
  const items = appointments
    .filter(item => item.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
  const next =
    items.find(item => item.status === 'in_consult') ??
    items.find(item => item.status === 'waiting') ??
    items.find(item => item.status === 'booked');
  return {
    items,
    next,
    waiting: items.filter(item => item.status === 'waiting').length,
    completed: items.filter(item => item.status === 'completed').length,
    flagged: items.some(item => item.status !== 'completed' && isFlagged(item)),
  };
}

export function isFlagged(appointment: Appointment) {
  return appointment.swelling || (appointment.painScore ?? 0) >= 8;
}

export function dentistGreeting(fullName: string, hour: number) {
  const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const name = fullName
    .replace(/^dr\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .pop();
  return `Good ${period}, ${name ? `Dr. ${name}` : 'Doctor'}`;
}
