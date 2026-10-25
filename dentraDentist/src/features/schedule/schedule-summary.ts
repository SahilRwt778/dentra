import type { Appointment, Dentist } from '../../common/types/api';
import type { TimeOff } from '../../common/types/availability';
import { addDays, formatDate } from '../../common/utils/date';

export function scheduleDayLabel(date: string, today: string) {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
  });
  return `${weekday}, ${formatDate(date).replace(/ \d{4}$/, '')}`;
}

export function scheduledAppointments(appointments: Appointment[]) {
  return appointments
    .filter(item => item.status !== 'cancelled')
    .sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
}

export function closedReason(
  date: string,
  dentist: Dentist,
  timeOff: TimeOff[] = [],
) {
  if (
    timeOff.some(
      leave => leave.allDay && leave.startDate <= date && leave.endDate >= date,
    )
  ) {
    return 'You have all-day time off on this date.';
  }
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const worksOn = (days?: number[]) =>
    days === undefined || days.includes(weekday);
  const videoOpen = dentist.offersVideo && worksOn(dentist.videoWorkingDays);
  const clinicOpen = dentist.clinics.some(clinic =>
    worksOn(clinic.workingDays),
  );
  return videoOpen || clinicOpen
    ? null
    : 'No consultation hours are set for this day.';
}
