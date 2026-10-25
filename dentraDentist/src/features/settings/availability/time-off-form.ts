import type { TimeOffInput } from '../../../common/types/availability';
import { dateKey } from '../../../common/utils/date';

export function newTimeOff(): TimeOffInput {
  return {
    startDate: dateKey(),
    endDate: dateKey(),
    allDay: true,
    fromTime: '10:00',
    toTime: '18:30',
    reason: '',
  };
}
export function timeOffInput(form: TimeOffInput): TimeOffInput {
  if (form.startDate < dateKey() || form.endDate < form.startDate)
    throw new Error(
      'Choose today or a future date, with the end date on or after the start date.',
    );
  if ((Date.parse(form.endDate) - Date.parse(form.startDate)) / 86400000 > 365)
    throw new Error('Time off can cover up to 366 days at a time.');
  if (
    !form.allDay &&
    (!form.fromTime || !form.toTime || form.fromTime >= form.toTime)
  )
    throw new Error('The end time must be after the start time.');
  return {
    startDate: form.startDate,
    endDate: form.endDate,
    allDay: form.allDay,
    ...(!form.allDay ? { fromTime: form.fromTime, toTime: form.toTime } : {}),
    ...(form.reason?.trim() ? { reason: form.reason.trim() } : {}),
  };
}
export { createRequestId as timeOffRequestId } from '../../../common/utils/request-id';
