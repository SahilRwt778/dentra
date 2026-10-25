import {
  initialForm,
  toApplication,
} from '../src/features/onboarding/application-form';
const valid = {
  ...initialForm(),
  fullName: ' Dentist One ',
  qualification: 'BDS',
  councilRegNo: 'SDC-100',
  primaryClinicName: 'Sample clinic',
  terms: true,
  yearsExperience: '5',
  feeVideo: '450.25',
  feeClinic: '600',
  languages: 'English, Hindi, ',
};
test('converts rupees to paise and trims fields for the existing application API', () => {
  expect(toApplication(valid)).toMatchObject({
    fullName: 'Dentist One',
    feeVideoPaise: 45025,
    feeClinicPaise: 60000,
    languages: ['English', 'Hindi'],
    yearsExperience: 5,
    termsConsent: true,
    telemedicineConsent: true,
  });
});
test.each([
  { terms: false },
  { councilRegNo: ' ' },
  { yearsExperience: '-1' },
  { yearsExperience: '1.5' },
  { feeClinic: 'NaN' },
  { feeVideo: '10.001' },
  { email: 'invalid' },
])('rejects incomplete or invalid application %p', invalid => {
  expect(() => toApplication({ ...valid, ...invalid })).toThrow();
});
test('video disabled submits no video fee', () => {
  expect(
    toApplication({ ...valid, offersVideo: false, feeVideo: '' }).feeVideoPaise,
  ).toBe(0);
});
