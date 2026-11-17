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
export function consultationDeadline(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
