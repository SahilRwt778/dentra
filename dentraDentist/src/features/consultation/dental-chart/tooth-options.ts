import type {
  ToothNumber,
  ToothStatus,
} from '../../../common/types/dental-chart';

export const UPPER_RIGHT: ToothNumber[] = [
  '18',
  '17',
  '16',
  '15',
  '14',
  '13',
  '12',
  '11',
];
export const UPPER_LEFT: ToothNumber[] = [
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
];
export const LOWER_RIGHT: ToothNumber[] = [
  '48',
  '47',
  '46',
  '45',
  '44',
  '43',
  '42',
  '41',
];
export const LOWER_LEFT: ToothNumber[] = [
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
];

export const TOOTH_OPTIONS: {
  value: ToothStatus;
  label: string;
  color: string;
  background: string;
}[] = [
  {
    value: 'healthy',
    label: 'Healthy',
    color: '#AFC0C6',
    background: '#FFFFFF',
  },
  { value: 'caries', label: 'Cavity', color: '#8B641D', background: '#FFF4DA' },
  { value: 'filled', label: 'Filled', color: '#3979A8', background: '#E8F2FC' },
  { value: 'crown', label: 'Crown', color: '#0C7D76', background: '#DEF1ED' },
  {
    value: 'rct',
    label: 'Root canal treated',
    color: '#7758AE',
    background: '#F0EBFA',
  },
  {
    value: 'missing',
    label: 'Missing',
    color: '#AFC0C6',
    background: '#F3F8F7',
  },
  {
    value: 'extract',
    label: 'To be extracted',
    color: '#C63430',
    background: '#FCECEA',
  },
];

export function toothOption(status: ToothStatus) {
  return (
    TOOTH_OPTIONS.find(option => option.value === status) ?? TOOTH_OPTIONS[0]
  );
}
