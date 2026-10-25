import { BadRequestException } from '@nestjs/common';
import { generateSlots, SLOT_MINUTES } from './slots.util';

export const ALL_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];
export type ResolvedHours = {
  from: string;
  to: string;
  clinicId: string | null;
  workingDays: number[];
};

export interface AvailabilityDentistRow {
  offers_video: boolean;
  video_hours_from: string | null;
  video_hours_to: string | null;
  video_working_days?: number[];
}

export interface AvailabilityClinicRow {
  id: string;
  hours_from: string;
  hours_to: string;
  working_days?: number[];
}

/**
 * The one rule for "what hours apply to this booking/slot lookup":
 * video uses the dentist's own hours; clinic uses the specific
 * location's hours, defaulted only when there's exactly one. Used by
 * both DentistsService.getSlots and AppointmentsService.book — written
 * once so a future change to this rule can't update one and silently
 * miss the other.
 */
export function resolveHours(
  dentist: AvailabilityDentistRow,
  clinics: AvailabilityClinicRow[],
  type: 'video' | 'clinic',
  clinicId?: string,
): ResolvedHours {
  if (type === 'video') {
    if (
      !dentist.offers_video ||
      !dentist.video_hours_from ||
      !dentist.video_hours_to
    ) {
      throw new BadRequestException(
        'This dentist does not offer video consults.',
      );
    }
    return {
      from: dentist.video_hours_from,
      to: dentist.video_hours_to,
      clinicId: null,
      workingDays: dentist.video_working_days ?? ALL_WORKING_DAYS,
    };
  }

  const clinic = clinicId
    ? clinics.find((c) => c.id === clinicId)
    : clinics.length === 1
    ? clinics[0]
    : undefined;
  if (!clinic) {
    throw new BadRequestException(
      clinics.length > 1
        ? 'clinicId is required — this dentist has more than one location.'
        : 'This dentist has no clinic locations.',
    );
  }
  return {
    from: clinic.hours_from,
    to: clinic.hours_to,
    clinicId: clinic.id,
    workingDays: clinic.working_days ?? ALL_WORKING_DAYS,
  };
}

/** Calendar weekdays are independent of the machine's timezone. A partial block
 * excludes every slot that overlaps it, including slots starting before leave. */
export function availableSlots(
  hours: ResolvedHours,
  date: string,
  blocks: { start_minute: number; end_minute: number }[],
) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (!hours.workingDays.includes(day)) return [];
  return generateSlots(hours.from, hours.to).filter((time) => {
    const [h, m] = time.split(':').map(Number);
    const start = h * 60 + m;
    return !blocks.some(
      (block) =>
        start < block.end_minute && start + SLOT_MINUTES > block.start_minute,
    );
  });
}
