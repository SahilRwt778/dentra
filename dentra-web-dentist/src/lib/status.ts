export const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  booked: { label: 'Scheduled', className: 'badge blue' },
  waiting: { label: 'Waiting', className: 'badge amber' },
  in_consult: { label: 'In consultation', className: 'badge teal' },
  completed: { label: 'Completed', className: 'badge green' },
  cancelled: { label: 'Cancelled', className: 'badge' },
};

export function statusBadge(status: string | undefined) {
  return STATUS_BADGE[status ?? ''] ?? { label: status ?? '', className: 'badge' };
}

/** Pain 8+/10 or reported swelling — flagged rows get a red left edge and an alert note, matching the prototype. */
export function isFlagged(a: { painScore?: number | null; swelling?: boolean }): boolean {
  return (a.painScore ?? 0) >= 8 || !!a.swelling;
}
