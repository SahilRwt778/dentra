import type {
  DentalChartState,
  ToothFinding,
  ToothNumber,
  ToothStatus,
} from '../../../common/types/dental-chart';

export function dentalChartForm(teeth: ToothFinding[]): DentalChartState {
  return Object.fromEntries(
    teeth.map(tooth => [tooth.toothNumber, tooth.status]),
  );
}

export function dentalChartChanges(
  form: DentalChartState,
  saved: DentalChartState,
): ToothFinding[] {
  return (Object.keys(form) as ToothNumber[])
    .filter(tooth => (form[tooth] ?? 'healthy') !== (saved[tooth] ?? 'healthy'))
    .map(toothNumber => ({
      toothNumber,
      status: form[toothNumber] ?? 'healthy',
    }));
}

export function markTooth(
  form: DentalChartState,
  tooth: ToothNumber,
  status: ToothStatus,
): DentalChartState {
  return { ...form, [tooth]: form[tooth] === status ? 'healthy' : status };
}
