import type { Dentist, DentistApplication } from '../../common/types/api';
export const specialties = [
  'General Dentist',
  'Orthodontist',
  'Endodontist',
  'Periodontist',
  'Oral Surgeon',
  'Prosthodontist',
  'Paediatric Dentist',
];
export function initialForm(dentist?: Dentist | null) {
  return {
    fullName: dentist?.fullName ?? '',
    email: dentist?.email ?? '',
    qualification: dentist?.qualification ?? '',
    specialization: dentist?.specialization || specialties[0],
    councilRegNo: dentist?.councilRegNo ?? '',
    yearsExperience: String(dentist?.yearsExperience ?? 0),
    languages: dentist?.languages?.join(', ') ?? '',
    primaryClinicName: dentist?.clinics?.[0]?.name ?? '',
    offersVideo: dentist?.offersVideo ?? true,
    feeVideo: String((dentist?.feeVideoPaise ?? 0) / 100),
    feeClinic: String((dentist?.feeClinicPaise ?? 0) / 100),
    terms: false,
  };
}
export type ApplicationForm = ReturnType<typeof initialForm>;
export function toApplication(form: ApplicationForm): DentistApplication {
  if (
    [
      form.fullName,
      form.qualification,
      form.specialization,
      form.councilRegNo,
      form.primaryClinicName,
    ].some(value => !value.trim())
  )
    throw new Error(
      'Fill in your name, qualification, specialization, council registration, and clinic.',
    );
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    throw new Error('Enter a valid email address.');
  if (!/^\d+$/.test(form.yearsExperience) || Number(form.yearsExperience) > 100)
    throw new Error('Enter years of experience between 0 and 100.');
  if (
    [form.feeClinic, ...(form.offersVideo ? [form.feeVideo] : [])].some(
      value => !/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 1000000,
    )
  )
    throw new Error(
      'Enter a valid consultation fee with at most two decimal places.',
    );
  if (!form.terms)
    throw new Error('Please agree to the terms and telemedicine guidelines.');
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim() || undefined,
    qualification: form.qualification.trim(),
    specialization: form.specialization,
    councilRegNo: form.councilRegNo.trim(),
    yearsExperience: Number(form.yearsExperience),
    languages: form.languages
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
    primaryClinicName: form.primaryClinicName.trim(),
    offersVideo: form.offersVideo,
    feeVideoPaise: form.offersVideo
      ? Math.round(Number(form.feeVideo) * 100)
      : 0,
    feeClinicPaise: Math.round(Number(form.feeClinic) * 100),
    termsConsent: true,
    telemedicineConsent: true,
  };
}
