import {
  clinicForm,
  clinicSubmission,
  feesUpdate,
  payoutForm,
  payoutSubmission,
  profileUpdate,
} from '../src/features/settings/settings-validation';

test('fee conversion keeps exact paise and accepts zero', () => {
  expect(
    feesUpdate({
      clinicFee: '0.29',
      videoFee: '10.01',
      offersVideo: true,
      from: '09:15',
      to: '17:45',
    }),
  ).toEqual({
    feeClinicPaise: 29,
    feeVideoPaise: 1001,
    offersVideo: true,
    videoHoursFrom: '09:15',
    videoHoursTo: '17:45',
  });
  expect(
    feesUpdate({
      clinicFee: '0',
      videoFee: '0',
      offersVideo: false,
      from: '18:00',
      to: '09:00',
    }),
  ).toEqual({ feeClinicPaise: 0, feeVideoPaise: 0, offersVideo: false });
});
test.each(['-1', '1.001', 'abc', '', '21474836.48'])(
  'rejects an invalid or unsupported fee: %s',
  value => {
    expect(() =>
      feesUpdate({
        clinicFee: value,
        videoFee: '10',
        offersVideo: false,
        from: '09:00',
        to: '17:00',
      }),
    ).toThrow();
  },
);
test('hours are validated only for offered video visits and clinic details survive an edit', () => {
  expect(() =>
    feesUpdate({
      clinicFee: '10',
      videoFee: '10',
      offersVideo: true,
      from: '18:00',
      to: '09:00',
    }),
  ).toThrow('Closing time');
  const clinic = {
    id: 'test-clinic',
    name: 'Old name',
    addressLine: 'Test address',
    pincode: '110001',
    phone: '+919999999999',
    hoursFrom: '09:00',
    hoursTo: '17:30',
  };
  expect(
    clinicSubmission({ ...clinicForm(clinic), name: ' New name ' }),
  ).toEqual({ ...clinicForm(clinic), name: 'New name' });
  expect(() =>
    clinicSubmission({ ...clinicForm(), hoursFrom: '17:00', hoursTo: '10:00' }),
  ).toThrow();
});
test('payout validation requires confirmation and uses the last observed request ID', () => {
  const profile = {
    approved: {
      bankAccountHolder: 'Test holder',
      bankAccountNo: '001234567890',
      bankIfsc: 'HDFC0001234',
      pan: 'ABCDE1234F',
      gstin: null,
    },
    request: null,
  };
  const form = payoutForm(profile);
  expect(form.confirmAccountNo).toBe('');
  expect(() => payoutSubmission(form, null)).toThrow(
    'Account numbers do not match',
  );
  expect(
    payoutSubmission(
      { ...form, confirmAccountNo: form.bankAccountNo },
      'latest-request',
    ),
  ).toMatchObject({
    bankAccountNo: '001234567890',
    previousRequestId: 'latest-request',
    gstin: null,
  });
});
test('professional profile saves the supported fields without changing login identity', () => {
  expect(
    profileUpdate({
      qualification: ' BDS ',
      specialization: ' General ',
      councilRegNo: ' REG-001 ',
      languages: ' English, Hindi, , ',
      email: 'test@example.test',
    }),
  ).toEqual({
    qualification: 'BDS',
    specialization: 'General',
    councilRegNo: 'REG-001',
    languages: ['English', 'Hindi'],
    email: 'test@example.test',
  });
});
