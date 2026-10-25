export type ToothNumber = `${1 | 2 | 3 | 4}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type ToothStatus =
  | 'healthy'
  | 'caries'
  | 'filled'
  | 'crown'
  | 'rct'
  | 'missing'
  | 'extract';
export type ToothFinding = { toothNumber: ToothNumber; status: ToothStatus };
export type DentalChartState = Partial<Record<ToothNumber, ToothStatus>>;
export type PatientDentalChart = { patientId: string; teeth: ToothFinding[] };
