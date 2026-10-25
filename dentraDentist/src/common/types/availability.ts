export type TimeOffInput = {
  startDate: string;
  endDate: string;
  allDay: boolean;
  fromTime?: string;
  toTime?: string;
  reason?: string;
};
export type TimeOff = Omit<TimeOffInput, 'fromTime' | 'toTime' | 'reason'> & {
  id: string;
  fromTime: string | null;
  toTime: string | null;
  reason: string | null;
};
export type TimeOffPreview = {
  total: number;
  appointments: {
    id: string;
    patientName: string;
    date: string;
    time: string;
    type: 'clinic' | 'video';
    clinicName: string | null;
  }[];
};
