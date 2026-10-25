// Synthetic examples only; this script never connects to the database or starts an API server.
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const {
  CarePdfRenderer,
} = require('../dist/modules/care/documents/care-pdf.renderer');
const output = process.argv[2] || join(__dirname, '../../output/pdf');
const sample = {
  schemaVersion: 1,
  source: 'event',
  capturedAt: '2026-10-18T07:30:00Z',
  platform: { name: 'Dentra', supportEmail: 'support@example.test' },
  appointment: {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'clinic',
    date: '2026-10-18',
    time: '12:00',
    completedAt: '2026-10-18T07:30:00Z',
  },
  patient: {
    name: 'Sample Patient - आरव शर्मा',
    dateOfBirth: '1990-04-15',
    age: 36,
    gender: 'Male',
  },
  dentist: {
    name: 'Dr. Sample Dentist',
    qualification: 'BDS',
    specialization: 'General dentistry',
    councilRegNo: 'SAMPLE-REG-001',
  },
  clinic: {
    name: 'Sample Dental Clinic',
    address: 'Example Street, Sample City',
    phone: '+91 9000000000',
  },
  consultation: {
    chiefComplaint: 'Synthetic example: patient-reported dental concern.',
    findings:
      'Synthetic examination findings recorded by the treating dentist. This sample is for layout testing only.',
    diagnosis: 'Sample diagnosis - not a real clinical record',
    treatmentDone: 'Sample treatment recorded during this visit.',
    plan: 'Sample plan and advice recorded by the dentist. This document contains synthetic data and must not be used for treatment.',
    followUpDate: '2026-11-01',
    isEdited: false,
    editedAt: null,
  },
  prescription: {
    id: '22222222-2222-4222-8222-222222222222',
    signedAt: '2026-10-18T07:20:00Z',
    items: [
      {
        medicineName: 'Sample medicine A',
        strength: 'Sample strength',
        dose: 'Sample dose',
        frequency: 'Sample frequency',
        duration: 'Sample duration',
        instructions: 'Synthetic example only. Do not use for treatment.',
      },
      {
        medicineName: 'Sample medicine B',
        strength: 'Sample strength',
        dose: 'Sample dose',
        frequency: 'Sample frequency',
        duration: 'Sample duration',
        instructions: 'Synthetic example only. Do not use for treatment.',
      },
    ],
  },
  chart: [{ tooth: '36', status: 'caries' }],
};
(async () => {
  await mkdir(output, { recursive: true });
  const renderer = new CarePdfRenderer();
  for (const kind of ['prescription', 'visit-summary']) {
    const path = join(output, `sample-${kind}.pdf`);
    await writeFile(path, await renderer.render({ ...sample, kind }));
    console.log(path);
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
