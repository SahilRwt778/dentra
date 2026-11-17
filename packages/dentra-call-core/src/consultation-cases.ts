export type ConsultationCaseBrief = {
  id: string;
  originalAppointmentId: string;
  activatedAt: string | null;
  expiresAt: string | null;
  status: 'pending' | 'active' | 'expired' | 'revoked';
};
export type ConsultationCase = ConsultationCaseBrief & {
  patientId: string;
  dentistId: string;
  patientName: string;
  dentistName: string;
  patientProfilePhotoUrl?: string | null;
  dentistProfilePhotoUrl?: string | null;
  concern: string;
  serverNow: string;
  canMessage: boolean;
  canBookFollowUp: boolean;
  unreadCount: number;
  latestMessageAt: string | null;
};
export type ConsultationCasePage = {
  items: ConsultationCase[];
  unreadCount: number;
  nextPage: number | null;
};
export const conversationFilters = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
] as const;
export type ConversationFilter = (typeof conversationFilters)[number]['value'];
export type ConsultationCaseQuery = {
  page?: number;
  filter?: ConversationFilter;
};
/** Keep displayed rows consistent with the selected tab, including older API responses. */
export function matchesConversationFilter(
  item: Pick<ConsultationCaseBrief, 'status'>,
  filter: ConversationFilter,
) {
  if (filter === 'all') return true;
  return filter === 'open'
    ? item.status === 'active' || item.status === 'pending'
    : item.status === 'expired' || item.status === 'revoked';
}
export function consultationDeadline(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
