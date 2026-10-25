import type { Clinic, Dentist } from '../../common/types/api';
import type {
  ClinicInput,
  DentistUpdate,
  PayoutProfile,
  PayoutSubmission,
} from '../../common/types/settings';

export type PayoutForm = Omit<
  PayoutSubmission,
  'previousRequestId' | 'gstin'
> & { gstin: string };
export function payoutForm(profile: PayoutProfile): PayoutForm {
  const source =
    profile.request?.status === 'rejected' ? profile.request : profile.approved;
  return {
    bankAccountHolder: source?.bankAccountHolder ?? '',
    bankAccountNo: source?.bankAccountNo ?? '',
    confirmAccountNo: '',
    bankIfsc: source?.bankIfsc ?? '',
    pan: source?.pan ?? '',
    gstin: source?.gstin ?? '',
  };
}
export function payoutSubmission(
  form: PayoutForm,
  previousRequestId: string | null,
): PayoutSubmission {
  const result = {
    bankAccountHolder: form.bankAccountHolder.trim(),
    bankAccountNo: form.bankAccountNo.trim(),
    confirmAccountNo: form.confirmAccountNo.trim(),
    bankIfsc: form.bankIfsc.trim().toUpperCase(),
    pan: form.pan.trim().toUpperCase(),
    gstin: form.gstin.trim().toUpperCase() || null,
    previousRequestId,
  };
  if (
    result.bankAccountHolder.length < 2 ||
    result.bankAccountHolder.length > 120
  )
    throw new Error('Enter an account holder name of 2–120 characters.');
  if (!/^\d{6,20}$/.test(result.bankAccountNo))
    throw new Error('Account number must contain 6–20 digits.');
  if (result.bankAccountNo !== result.confirmAccountNo)
    throw new Error('Account numbers do not match.');
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(result.bankIfsc))
    throw new Error('Enter a valid 11-character IFSC.');
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(result.pan))
    throw new Error('Enter a valid PAN.');
  if (
    result.gstin &&
    !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(result.gstin)
  )
    throw new Error('Enter a valid GSTIN or leave it blank.');
  return result;
}

export type ProfileForm = {
  qualification: string;
  specialization: string;
  councilRegNo: string;
  languages: string;
  email: string;
};
export function profileForm(dentist: Dentist): ProfileForm {
  return {
    qualification: dentist.qualification,
    specialization: dentist.specialization,
    councilRegNo: dentist.councilRegNo,
    languages: dentist.languages.join(', '),
    email: dentist.email ?? '',
  };
}
export function profileUpdate(form: ProfileForm): DentistUpdate {
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Enter a valid email address.');
  if (
    !form.qualification.trim() ||
    !form.specialization.trim() ||
    !form.councilRegNo.trim()
  )
    throw new Error(
      'Fill in your qualification, specialization and registration number.',
    );
  return {
    qualification: form.qualification.trim(),
    specialization: form.specialization.trim(),
    councilRegNo: form.councilRegNo.trim(),
    languages: form.languages
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
    ...(email ? { email } : {}),
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
function validHours(from: string, to: string) {
  if (!TIME.test(from) || !TIME.test(to) || from >= to)
    throw new Error('Closing time must be after opening time.');
}
export function clinicForm(clinic?: Clinic): ClinicInput {
  return {
    name: clinic?.name ?? '',
    addressLine: clinic?.addressLine ?? '',
    pincode: clinic?.pincode ?? '',
    phone: clinic?.phone ?? '',
    hoursFrom: clinic?.hoursFrom.slice(0, 5) ?? '10:00',
    hoursTo: clinic?.hoursTo.slice(0, 5) ?? '18:30',
    workingDays: clinic?.workingDays ?? [0, 1, 2, 3, 4, 5, 6],
  };
}
export function clinicSubmission(form: ClinicInput): ClinicInput {
  if (!form.name.trim()) throw new Error('Enter a clinic name.');
  validHours(form.hoursFrom, form.hoursTo);
  return {
    ...form,
    name: form.name.trim(),
    addressLine: form.addressLine?.trim(),
    pincode: form.pincode?.trim(),
    phone: form.phone?.trim(),
  };
}

export type FeesForm = {
  clinicFee: string;
  videoFee: string;
  offersVideo: boolean;
  workingDays?: number[];
  from: string;
  to: string;
};
export function feesForm(dentist: Dentist): FeesForm {
  return {
    clinicFee: String(dentist.feeClinicPaise / 100),
    videoFee: String(dentist.feeVideoPaise / 100),
    offersVideo: dentist.offersVideo,
    workingDays: dentist.videoWorkingDays ?? [0, 1, 2, 3, 4, 5, 6],
    from: dentist.videoHoursFrom?.slice(0, 5) || '10:00',
    to: dentist.videoHoursTo?.slice(0, 5) || '18:30',
  };
}
function paise(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed))
    throw new Error(
      'Enter a fee of zero or more, with up to two decimal places.',
    );
  const [whole, decimal = ''] = trimmed.split('.');
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 2147483647)
    throw new Error('The consultation fee is too high.');
  return amount;
}
export function feesUpdate(form: FeesForm): DentistUpdate {
  if (form.offersVideo) validHours(form.from, form.to);
  return {
    feeClinicPaise: paise(form.clinicFee),
    feeVideoPaise: paise(form.videoFee),
    offersVideo: form.offersVideo,
    ...(form.workingDays ? { videoWorkingDays: form.workingDays } : {}),
    ...(form.offersVideo
      ? { videoHoursFrom: form.from, videoHoursTo: form.to }
      : {}),
  };
}
