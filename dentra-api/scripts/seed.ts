import { Pool } from 'pg';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Wipes every data table and refills them with one coherent, cross-
 * referenced dataset — the same dentists, patients and appointments as
 * ../../index.html's seed() function (same names, specializations,
 * clinics, allergies, consultations, prescriptions), adapted to this
 * schema's real constraints (E.164 mobiles, real dates instead of
 * relative placeholders, enum values, FK-linked IDs returned from each
 * insert rather than hardcoded "D1"/"P1" strings).
 *
 * Run with DATABASE_URL already in the environment:
 *   set -a && source .env && set +a && npm run seed
 *
 * This is destructive — every row in every table listed below is gone
 * after this runs, including any admin accounts. The script recreates
 * one admin account at the end (the prototype's own demo credentials),
 * so there's always a working login afterward.
 */

const ADMIN_EMAIL = 'admin@dentra.in';
const ADMIN_PASSWORD = 'Admin@123';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
const TODAY = addDays(0);

interface DentistSeed {
  code: string;
  fullName: string;
  qualification: string;
  specialization: string;
  yearsExperience: number;
  languages: string[];
  mobile: string;
  email?: string;
  clinicName: string;
  feeVideoPaise: number;
  feeClinicPaise: number;
  offersVideo: boolean;
  councilRegNo: string;
  councilRegValidTill: string;
  dateOfBirth: string;
  gender: string;
  pan?: string;
  bankHolder?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  status: 'verified' | 'pending_review';
  submittedBy: 'self' | 'admin';
  submittedAtDaysAgo: number;
  kyc: Partial<Record<'degree' | 'council' | 'id_proof' | 'clinic_proof' | 'insurance' | 'selfie', boolean>>;
}

const DENTISTS: DentistSeed[] = [
  {
    code: 'D1',
    fullName: 'Dr. Ananya Kapoor',
    qualification: 'BDS, MDS (Conservative Dentistry & Endodontics)',
    specialization: 'Endodontist',
    yearsExperience: 12,
    languages: ['Hindi', 'English', 'Punjabi'],
    mobile: '+919820010482',
    email: 'ananya.kapoor@smileaxis.in',
    clinicName: 'Smile Axis Dental, Lajpat Nagar',
    feeVideoPaise: 60000,
    feeClinicPaise: 80000,
    offersVideo: true,
    councilRegNo: 'DEMO-DSDC-10482',
    councilRegValidTill: addDays(900),
    dateOfBirth: '1988-03-11',
    gender: 'Female',
    pan: 'ABCDE1234F',
    bankHolder: 'Ananya Kapoor',
    bankAccountNo: 'XXXXXX4821',
    bankIfsc: 'HDFC0001234',
    status: 'verified',
    submittedBy: 'self',
    submittedAtDaysAgo: 420,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: true, insurance: true, selfie: true },
  },
  {
    code: 'D2',
    fullName: 'Dr. Rahul Menon',
    qualification: 'BDS',
    specialization: 'General Dentist',
    yearsExperience: 8,
    languages: ['English', 'Hindi', 'Tamil'],
    mobile: '+919820009317',
    clinicName: 'CareDent, Saket',
    feeVideoPaise: 40000,
    feeClinicPaise: 50000,
    offersVideo: true,
    councilRegNo: 'DEMO-DSDC-09317',
    councilRegValidTill: addDays(540),
    dateOfBirth: '1992-07-02',
    gender: 'Male',
    status: 'verified',
    submittedBy: 'self',
    submittedAtDaysAgo: 300,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: true, insurance: false, selfie: true },
  },
  {
    code: 'D3',
    fullName: 'Dr. Sana Qureshi',
    qualification: 'BDS, MDS (Periodontology)',
    specialization: 'Periodontist',
    yearsExperience: 10,
    languages: ['Hindi', 'English'],
    mobile: '+919820008861',
    clinicName: 'GumCare Clinic, Rajouri Garden',
    feeVideoPaise: 60000,
    feeClinicPaise: 90000,
    offersVideo: true,
    councilRegNo: 'DEMO-DSDC-08861',
    councilRegValidTill: addDays(700),
    dateOfBirth: '1990-11-23',
    gender: 'Female',
    status: 'verified',
    submittedBy: 'self',
    submittedAtDaysAgo: 360,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: true, insurance: true, selfie: true },
  },
  {
    code: 'D4',
    fullName: 'Dr. Vikram Singh',
    qualification: 'BDS, MDS (Oral & Maxillofacial Surgery)',
    specialization: 'Oral Surgeon',
    yearsExperience: 15,
    languages: ['Hindi', 'English', 'Punjabi'],
    mobile: '+919820005220',
    clinicName: 'Metro Dental & Facial, Dwarka',
    feeVideoPaise: 0,
    feeClinicPaise: 120000,
    offersVideo: false,
    councilRegNo: 'DEMO-DSDC-05220',
    councilRegValidTill: addDays(300),
    dateOfBirth: '1983-01-09',
    gender: 'Male',
    status: 'verified',
    submittedBy: 'self',
    submittedAtDaysAgo: 500,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: true, insurance: true, selfie: true },
  },
  {
    code: 'D5',
    fullName: 'Dr. Priyanka Das',
    qualification: 'BDS, MDS (Orthodontics)',
    specialization: 'Orthodontist',
    yearsExperience: 9,
    languages: ['English', 'Bengali', 'Hindi'],
    mobile: '+919820011094',
    clinicName: 'AlignRight, Vasant Kunj',
    feeVideoPaise: 70000,
    feeClinicPaise: 100000,
    offersVideo: true,
    councilRegNo: 'DEMO-DSDC-11094',
    councilRegValidTill: addDays(820),
    dateOfBirth: '1991-05-30',
    gender: 'Female',
    status: 'verified',
    submittedBy: 'self',
    submittedAtDaysAgo: 310,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: true, insurance: false, selfie: true },
  },
  {
    code: 'D6',
    fullName: 'Dr. Neha Arora',
    qualification: 'BDS',
    specialization: 'General Dentist',
    yearsExperience: 5,
    languages: ['Hindi', 'English'],
    mobile: '+919821020417',
    clinicName: 'Tooth Tales Family Dental, Noida Sector 18',
    feeVideoPaise: 30000,
    feeClinicPaise: 40000,
    offersVideo: true,
    councilRegNo: 'DEMO-UPSDC-20417',
    councilRegValidTill: addDays(430),
    dateOfBirth: '1996-09-18',
    gender: 'Female',
    status: 'verified',
    submittedBy: 'self',
    submittedAtDaysAgo: 200,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: true, insurance: false, selfie: true },
  },
  {
    code: 'D7',
    fullName: 'Dr. Arjun Bhatia',
    qualification: 'BDS, MDS (Paediatric & Preventive Dentistry)',
    specialization: 'Paediatric Dentist',
    yearsExperience: 11,
    languages: ['Hindi', 'English'],
    mobile: '+919822003318',
    clinicName: 'Little Smiles, Gurugram',
    feeVideoPaise: 50000,
    feeClinicPaise: 70000,
    offersVideo: true,
    councilRegNo: 'DEMO-HSDC-03318',
    councilRegValidTill: addDays(610),
    dateOfBirth: '1989-02-14',
    gender: 'Male',
    status: 'verified',
    submittedBy: 'self',
    submittedAtDaysAgo: 380,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: true, insurance: true, selfie: true },
  },
  {
    code: 'D8',
    fullName: 'Dr. Farhan Ali',
    qualification: 'BDS, MDS (Prosthodontics)',
    specialization: 'Prosthodontist',
    yearsExperience: 7,
    languages: ['Hindi', 'English'],
    mobile: '+919822004471',
    email: 'farhan.ali@example.com',
    clinicName: 'Crown & Bridge Studio, Sector 29 Gurugram',
    feeVideoPaise: 60000,
    feeClinicPaise: 90000,
    offersVideo: true,
    councilRegNo: 'DEMO-HSDC-04471',
    councilRegValidTill: addDays(760),
    dateOfBirth: '1994-06-21',
    gender: 'Male',
    pan: 'FGHIJ5678K',
    bankHolder: 'Farhan Ali',
    bankAccountNo: 'XXXXXX9012',
    bankIfsc: 'ICIC0005678',
    status: 'pending_review',
    submittedBy: 'self',
    submittedAtDaysAgo: 3,
    kyc: { degree: true, council: true, id_proof: true, clinic_proof: false, insurance: false, selfie: true },
  },
  {
    code: 'D9',
    fullName: 'Dr. Ishita Rao',
    qualification: 'BDS',
    specialization: 'General Dentist',
    yearsExperience: 3,
    languages: ['English', 'Hindi', 'Bengali'],
    mobile: '+919821021906',
    email: 'ishita.rao@example.com',
    clinicName: 'BrightBite Dental, Indirapuram',
    feeVideoPaise: 30000,
    feeClinicPaise: 45000,
    offersVideo: true,
    councilRegNo: 'DEMO-UPSDC-21906',
    councilRegValidTill: addDays(500),
    dateOfBirth: '1999-10-05',
    gender: 'Female',
    status: 'pending_review',
    submittedBy: 'admin',
    submittedAtDaysAgo: 1,
    // Deliberately incomplete — degree and ID proof on file, council
    // registration and selfie missing — so the admin review queue has
    // a real "docs missing" case to show, not just complete ones.
    kyc: { degree: true, council: false, id_proof: true, clinic_proof: false, insurance: false, selfie: false },
  },
];

interface PatientSeed {
  code: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  mobile: string;
  email?: string;
  city: string;
  preferredLang: string;
  allergies: string;
  conditions: string;
  medications: string;
  emergencyContact: string;
  baselineChart?: { tooth: string; status: string; daysAgo: number }[];
}

const PATIENTS: PatientSeed[] = [
  {
    code: 'P1',
    fullName: 'Aarav Mehta',
    dateOfBirth: '1996-04-14',
    gender: 'Male',
    mobile: '+919810023456',
    email: 'aarav.mehta@example.com',
    city: 'New Delhi',
    preferredLang: 'English',
    allergies: 'Lidocaine (dental numbing injection) – itching and swelling',
    conditions: 'None',
    medications: 'None',
    emergencyContact: 'Riya Mehta (sister), +91 98111 40221',
  },
  {
    code: 'P2',
    fullName: 'Meera Joshi',
    dateOfBirth: '1984-09-02',
    gender: 'Female',
    mobile: '+919873055120',
    city: 'Lajpat Nagar',
    preferredLang: 'Hindi',
    allergies: 'None known',
    conditions: 'Hypothyroidism',
    medications: 'Levothyroxine 50 mcg',
    emergencyContact: 'Amit Joshi (husband), +91 98730 55121',
    baselineChart: [{ tooth: '26', status: 'filled', daysAgo: 200 }],
  },
  {
    code: 'P3',
    fullName: 'Rohan Gupta',
    dateOfBirth: '1991-12-20',
    gender: 'Male',
    mobile: '+919999012873',
    city: 'Defence Colony',
    preferredLang: 'English',
    allergies: 'None known',
    conditions: 'None',
    medications: 'None',
    emergencyContact: 'Sunita Gupta (mother), +91 99990 12870',
  },
  {
    code: 'P4',
    fullName: 'Kavya Iyer',
    dateOfBirth: '2000-06-11',
    gender: 'Female',
    mobile: '+919810577342',
    city: 'Greater Kailash',
    preferredLang: 'English',
    allergies: 'Penicillin',
    conditions: 'None',
    medications: 'None',
    emergencyContact: 'R. Iyer (father), +91 98105 77300',
    baselineChart: [{ tooth: '11', status: 'crown', daysAgo: 150 }],
  },
  {
    code: 'P5',
    fullName: 'Sunil Verma',
    dateOfBirth: '1968-01-27',
    gender: 'Male',
    mobile: '+919811230988',
    city: 'Kalkaji',
    preferredLang: 'Hindi',
    allergies: 'None known',
    conditions: 'Type 2 diabetes',
    medications: 'Metformin 500 mg',
    emergencyContact: 'Anita Verma (wife), +91 98112 30989',
    baselineChart: [
      { tooth: '46', status: 'rct', daysAgo: 500 },
      { tooth: '47', status: 'crown', daysAgo: 500 },
    ],
  },
];

const MED_PRESETS = {
  chlorhexidine: {
    medicineName: 'Chlorhexidine gluconate mouthwash',
    strength: '0.2%',
    dose: '10 ml',
    frequency: 'Twice a day (1-0-1)',
    duration: '7 days',
    instructions: 'Rinse for 30 seconds after brushing. Do not swallow.',
  },
  potassiumNitrate: {
    medicineName: 'Potassium nitrate toothpaste',
    strength: '5%',
    dose: 'Pea-sized amount',
    frequency: 'Twice a day (1-0-1)',
    duration: '4 weeks',
    instructions: 'Use with a soft-bristle brush for sensitivity.',
  },
};

interface AppointmentSeed {
  code: string;
  patientCode: string;
  dentistCode: string;
  type: 'video' | 'clinic';
  date: string;
  time: string;
  concern: string;
  concerns?: string[];
  symptomArea?: string;
  symptomSince?: string;
  painScore?: number;
  swelling?: boolean;
  note?: string;
  status: 'booked' | 'waiting' | 'completed' | 'cancelled';
  paymentMethod: 'upi' | 'card' | 'netbanking';
  amountPaise: number;
  paymentStatus: 'paid' | 'refunded';
  consult?: {
    chiefComplaint: string;
    findings: string;
    diagnosis: string;
    treatmentDone: string;
    plan: string;
    followUpDaysFromNow?: number;
    chartChanges?: { tooth: string; status: string }[];
    prescriptionItem?: keyof typeof MED_PRESETS;
  };
}

const APPOINTMENTS: AppointmentSeed[] = [
  {
    code: 'A1',
    patientCode: 'P3',
    dentistCode: 'D1',
    type: 'clinic',
    date: TODAY,
    time: '10:00',
    concern: 'Sensitivity',
    symptomArea: 'Upper left, back',
    symptomSince: '1 week',
    painScore: 3,
    swelling: false,
    note: 'Sharp twinge with cold water.',
    status: 'completed',
    paymentMethod: 'upi',
    amountPaise: 80000,
    paymentStatus: 'paid',
    consult: {
      chiefComplaint: 'Sensitivity to cold, upper left back teeth, 1 week',
      findings: 'Cervical abrasion on 24 and 25. No caries. Gums healthy.',
      diagnosis: 'Dentine hypersensitivity, 24 and 25',
      treatmentDone: 'Fluoride varnish applied.',
      plan: 'Brush with a soft brush and gentle strokes. Review if sensitivity continues.',
      followUpDaysFromNow: 28,
      chartChanges: [
        { tooth: '24', status: 'healthy' },
        { tooth: '25', status: 'healthy' },
      ],
      prescriptionItem: 'potassiumNitrate',
    },
  },
  {
    code: 'A2',
    patientCode: 'P2',
    dentistCode: 'D1',
    type: 'video',
    date: TODAY,
    time: '11:30',
    concern: 'Toothache, Sensitivity',
    concerns: ['Toothache', 'Sensitivity'],
    symptomArea: 'Lower right, back',
    symptomSince: '2–3 days',
    painScore: 8,
    swelling: true,
    note: 'Pain wakes me up at night. Cheek is a little swollen.',
    status: 'waiting',
    paymentMethod: 'upi',
    amountPaise: 60000,
    paymentStatus: 'paid',
  },
  {
    code: 'A3',
    patientCode: 'P5',
    dentistCode: 'D1',
    type: 'clinic',
    date: TODAY,
    time: '12:30',
    concern: 'Bleeding gums, Check-up and cleaning',
    concerns: ['Bleeding gums', 'Check-up and cleaning'],
    symptomArea: 'Whole mouth',
    symptomSince: 'Longer than a week',
    painScore: 2,
    swelling: false,
    note: 'Gums bleed while brushing.',
    status: 'booked',
    paymentMethod: 'card',
    amountPaise: 80000,
    paymentStatus: 'paid',
  },
  {
    code: 'A4',
    patientCode: 'P4',
    dentistCode: 'D1',
    type: 'video',
    date: TODAY,
    time: '15:00',
    concern: 'Broken or chipped tooth',
    symptomArea: 'Upper, front',
    symptomSince: 'Today',
    painScore: 4,
    swelling: false,
    note: 'Chipped the edge of my front tooth on a hard sweet.',
    status: 'booked',
    paymentMethod: 'netbanking',
    amountPaise: 60000,
    paymentStatus: 'paid',
  },
  {
    code: 'A5',
    patientCode: 'P1',
    dentistCode: 'D2',
    type: 'clinic',
    date: addDays(-84),
    time: '11:00',
    concern: 'Check-up and cleaning',
    symptomArea: 'Whole mouth',
    symptomSince: 'Longer than a week',
    painScore: 0,
    swelling: false,
    status: 'completed',
    paymentMethod: 'upi',
    amountPaise: 50000,
    paymentStatus: 'paid',
    consult: {
      chiefComplaint: 'Routine check-up and cleaning',
      findings: 'Mild calculus on lower front teeth. Existing filling on 36 intact. 48 missing.',
      diagnosis: 'Mild gingivitis',
      treatmentDone: 'Scaling and polishing done. OPG X-ray taken.',
      plan: 'Brush twice a day and floss once a day. Next check-up in 6 months.',
      followUpDaysFromNow: 98,
      chartChanges: [
        { tooth: '36', status: 'filled' },
        { tooth: '48', status: 'missing' },
      ],
      prescriptionItem: 'chlorhexidine',
    },
  },
  {
    code: 'A6',
    patientCode: 'P3',
    dentistCode: 'D3',
    type: 'clinic',
    date: TODAY,
    time: '10:30',
    concern: 'Check-up and cleaning',
    symptomArea: 'Whole mouth',
    symptomSince: 'Longer than a week',
    painScore: 0,
    swelling: false,
    status: 'completed',
    paymentMethod: 'card',
    amountPaise: 90000,
    paymentStatus: 'paid',
    consult: {
      chiefComplaint: 'Check-up',
      findings: 'Healthy gums.',
      diagnosis: 'No active disease',
      treatmentDone: 'Scaling and polishing.',
      plan: 'Routine review in 6 months.',
    },
  },
  {
    code: 'A7',
    patientCode: 'P4',
    dentistCode: 'D2',
    type: 'video',
    date: TODAY,
    time: '13:00',
    concern: 'Sensitivity',
    symptomArea: 'Lower left, back',
    symptomSince: '1 week',
    painScore: 2,
    swelling: false,
    status: 'cancelled',
    paymentMethod: 'upi',
    amountPaise: 40000,
    paymentStatus: 'refunded',
  },
  {
    code: 'A8',
    patientCode: 'P2',
    dentistCode: 'D5',
    type: 'clinic',
    date: addDays(1),
    time: '16:00',
    concern: 'Braces or aligners',
    symptomArea: 'Whole mouth',
    symptomSince: 'Longer than a week',
    painScore: 0,
    swelling: false,
    note: 'Want to know about aligners.',
    status: 'booked',
    paymentMethod: 'upi',
    amountPaise: 100000,
    paymentStatus: 'paid',
  },
  {
    code: 'A9',
    patientCode: 'P5',
    dentistCode: 'D1',
    type: 'clinic',
    date: addDays(2),
    time: '11:00',
    concern: 'Toothache',
    symptomArea: 'Lower right, back',
    symptomSince: '2–3 days',
    painScore: 5,
    swelling: false,
    status: 'booked',
    paymentMethod: 'upi',
    amountPaise: 80000,
    paymentStatus: 'paid',
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — source .env first.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Truncating all tables...');
    await client.query(`
      truncate table
        audit_log, notifications, privacy_requests, transactions,
        dental_chart_entries, prescription_items, prescriptions,
        consultations, appointments, otp_codes, refresh_tokens,
        dentist_documents, dentist_clinics, dentists, patients, users
      cascade
    `);

    console.log('Seeding admin...');
    const adminPasswordHash = await hashPassword(ADMIN_PASSWORD);
    const {
      rows: [admin],
    } = await client.query(
      `insert into users (role, email, password_hash, status) values ('admin', $1, $2, 'active') returning id`,
      [ADMIN_EMAIL, adminPasswordHash],
    );
    const adminId: string = admin.id;

    console.log('Seeding dentists...');
    const dentistIdByCode = new Map<string, string>();
    const clinicIdByDentistCode = new Map<string, string>();

    for (const d of DENTISTS) {
      const { rows: userRows } = await client.query(
        `insert into users (role, mobile, email, status) values ('dentist', $1, $2, 'active') returning id`,
        [d.mobile, d.email ?? null],
      );
      const userId: string = userRows[0].id;
      dentistIdByCode.set(d.code, userId);

      const reviewed = d.status === 'verified';
      await client.query(
        `insert into dentists (
           user_id, full_name, date_of_birth, gender, email, qualification, specialization,
           years_experience, languages, council_reg_no, council_reg_valid_till,
           offers_video, fee_video_paise, fee_clinic_paise, video_hours_from, video_hours_to,
           pan, bank_account_holder, bank_account_no, bank_ifsc,
           status, submitted_by, submitted_at, reviewed_by, reviewed_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
           now() - ($23 || ' days')::interval,
           $24, $25
         )`,
        [
          userId,
          d.fullName,
          d.dateOfBirth,
          d.gender,
          d.email ?? null,
          d.qualification,
          d.specialization,
          d.yearsExperience,
          d.languages,
          d.councilRegNo,
          d.councilRegValidTill,
          d.offersVideo,
          d.feeVideoPaise,
          d.feeClinicPaise,
          d.offersVideo ? '10:00' : null,
          d.offersVideo ? '18:30' : null,
          d.pan ?? null,
          d.bankHolder ?? null,
          d.bankAccountNo ?? null,
          d.bankIfsc ?? null,
          d.status,
          d.submittedBy,
          d.submittedAtDaysAgo,
          reviewed ? adminId : null,
          reviewed ? new Date(Date.now() - (d.submittedAtDaysAgo - 1) * 86400000) : null,
        ],
      );

      const { rows: clinicRows } = await client.query(
        `insert into dentist_clinics (dentist_id, name, hours_from, hours_to) values ($1, $2, '10:00', '18:30') returning id`,
        [userId, d.clinicName],
      );
      clinicIdByDentistCode.set(d.code, clinicRows[0].id);

      for (const [docType, present] of Object.entries(d.kyc)) {
        if (!present) continue;
        await client.query(
          `insert into dentist_documents (dentist_id, doc_type, file_url, is_seed_placeholder, verified_by, verified_at)
           values ($1, $2, $3, true, $4, $5)`,
          [
            userId,
            docType,
            `seed-placeholder/${d.code}/${docType}`,
            reviewed ? adminId : null,
            reviewed ? new Date() : null,
          ],
        );
      }
    }

    console.log('Seeding patients...');
    const patientIdByCode = new Map<string, string>();

    for (const p of PATIENTS) {
      const { rows: userRows } = await client.query(
        `insert into users (role, mobile, status) values ('patient', $1, 'active') returning id`,
        [p.mobile],
      );
      const userId: string = userRows[0].id;
      patientIdByCode.set(p.code, userId);

      await client.query(
        `insert into patients (
           user_id, full_name, date_of_birth, gender, email, city, preferred_lang,
           allergies, conditions, medications, emergency_contact
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          userId,
          p.fullName,
          p.dateOfBirth,
          p.gender,
          p.email ?? null,
          p.city,
          p.preferredLang,
          p.allergies,
          p.conditions,
          p.medications,
          p.emergencyContact,
        ],
      );

      for (const entry of p.baselineChart ?? []) {
        await client.query(
          `insert into dental_chart_entries (patient_id, tooth_number, status, recorded_at)
           values ($1, $2, $3, now() - ($4 || ' days')::interval)`,
          [userId, entry.tooth, entry.status, entry.daysAgo],
        );
      }
    }

    console.log('Seeding appointments, transactions, consultations, prescriptions, chart entries...');
    for (const a of APPOINTMENTS) {
      const patientId = patientIdByCode.get(a.patientCode)!;
      const dentistId = dentistIdByCode.get(a.dentistCode)!;
      const clinicId = a.type === 'clinic' ? clinicIdByDentistCode.get(a.dentistCode)! : null;

      const { rows: apptRows } = await client.query(
        `insert into appointments (
           patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time, status,
           concern_summary, concerns, symptom_area, symptom_since, pain_score, swelling, note,
           completed_at, cancelled_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         returning id`,
        [
          patientId,
          dentistId,
          clinicId,
          a.type,
          a.date,
          a.time,
          a.status,
          a.concern,
          a.concerns ?? [a.concern],
          a.symptomArea ?? null,
          a.symptomSince ?? null,
          a.painScore ?? null,
          a.swelling ?? false,
          a.note ?? null,
          a.status === 'completed' ? new Date() : null,
          a.status === 'cancelled' ? new Date() : null,
        ],
      );
      const appointmentId: string = apptRows[0].id;

      await client.query(
        `insert into transactions (appointment_id, idempotency_key, amount_paise, method, status, gateway_ref)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          appointmentId,
          `seed-${a.code}`,
          a.amountPaise,
          a.paymentMethod,
          a.paymentStatus,
          `seed-gateway-ref-${a.code}`,
        ],
      );

      if (!a.consult) continue;

      await client.query(
        `insert into consultations (appointment_id, chief_complaint, findings, diagnosis, treatment_done, plan, follow_up_date)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          appointmentId,
          a.consult.chiefComplaint,
          a.consult.findings,
          a.consult.diagnosis,
          a.consult.treatmentDone,
          a.consult.plan,
          a.consult.followUpDaysFromNow != null ? addDays(a.consult.followUpDaysFromNow) : null,
        ],
      );

      for (const change of a.consult.chartChanges ?? []) {
        await client.query(
          `insert into dental_chart_entries (patient_id, tooth_number, status, recorded_by_dentist_id, appointment_id)
           values ($1, $2, $3, $4, $5)`,
          [patientId, change.tooth, change.status, dentistId, appointmentId],
        );
      }

      if (a.consult.prescriptionItem) {
        const med = MED_PRESETS[a.consult.prescriptionItem];
        const {
          rows: [rx],
        } = await client.query(
          `insert into prescriptions (appointment_id, signed_by_dentist_id, signed_at, signature_ref)
           values ($1, $2, now(), $3) returning id`,
          [appointmentId, dentistId, `seed-signature-${a.code}`],
        );
        await client.query(
          `insert into prescription_items (prescription_id, medicine_name, strength, dose, frequency, duration, instructions, sort_order)
           values ($1,$2,$3,$4,$5,$6,$7,0)`,
          [rx.id, med.medicineName, med.strength, med.dose, med.frequency, med.duration, med.instructions],
        );
      }
    }

    console.log('Seeding privacy request and audit log...');
    await client.query(
      `insert into privacy_requests (patient_id, type, status, sla_due_at, created_at)
       values ($1, 'export', 'open', now() + interval '28 days', now() - interval '2 days')`,
      [patientIdByCode.get('P3')],
    );

    for (const d of DENTISTS.filter((d) => d.status === 'pending_review')) {
      await client.query(
        `insert into audit_log (actor_user_id, actor_label, action, entity_type, entity_id, detail, created_at)
         values ($1, $2, 'onboarding_submitted', 'dentist', $3, $4, now() - ($5 || ' days')::interval)`,
        [
          d.submittedBy === 'admin' ? adminId : dentistIdByCode.get(d.code),
          d.submittedBy === 'admin' ? 'Dentra admin' : d.fullName,
          dentistIdByCode.get(d.code),
          d.submittedBy === 'admin'
            ? `Admin-created application started for ${d.fullName}`
            : `Self-serve application submitted by ${d.fullName}`,
          d.submittedAtDaysAgo,
        ],
      );
    }

    await client.query('COMMIT');

    console.log('\nSeed complete.');
    console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log(`${DENTISTS.length} dentists (${DENTISTS.filter((d) => d.status === 'verified').length} verified, ${DENTISTS.filter((d) => d.status === 'pending_review').length} pending review)`);
    console.log(`${PATIENTS.length} patients, ${APPOINTMENTS.length} appointments`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
