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
  item: Pick<ConsultationCase, 'canMessage'>,
  filter: ConversationFilter,
) {
  if (filter === 'all') return true;
  return filter === 'open' ? item.canMessage : !item.canMessage;
}
export function conversationMessagingLabel(
  item: Pick<ConsultationCase, 'canMessage' | 'expiresAt'>,
) {
  if (!item.canMessage) return 'Closed · History available';
  return item.expiresAt
    ? `Open until ${consultationDeadline(item.expiresAt)}`
    : 'Messaging open';
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
