import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';
import { OtpService } from '../../src/modules/identity/auth/otp.service';
import * as otpHash from '../../src/common/utils/otp-hash.util';

/**
 * The booking → consult → prescription → complete pipeline, including
 * the double-booking constraint, idempotency replay, and the allergy
 * check — the things actually exercised by hand while building this
 * module, now locked in.
 */
describe('Care: appointments + consultations (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let gateway: RazorpayGatewayService;
  let logSpy: jest.SpyInstance;
  let webhookSecret: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    gateway = app.get(RazorpayGatewayService);
    webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  });

  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  // Simulates Razorpay's payment.captured callback for a given order,
  // self-signed with the same webhook secret the app itself verifies
  // against — this is the only way a booking's transaction ever reaches
  // 'paid' now that book() no longer stubs it synchronously.
  async function simulateCapture(orderId: string): Promise<string> {
    const paymentId = `pay_e2e_${Date.now()}`;
    const { rows } = await pool.query('select amount_paise from transactions where gateway_ref = $1', [orderId]);
    const payload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: paymentId, order_id: orderId, amount: rows[0].amount_paise, currency: 'INR' } } },
    };
    const raw = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', webhookSecret).update(raw).digest('hex');
    await request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signature)
      .send(raw)
      .expect(200);
    return paymentId;
  }

  function freshMobile(prefix: string): string {
    const n = Math.floor(1_000_000_00 + Math.random() * 8_999_999_99);
    return `+91${prefix}${n}`;
  }

  async function verifiedToken(mobile: string, purpose: 'patient' | 'dentist'): Promise<string> {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    const req = await request(app.getHttpServer()).post('/auth/otp/request').send({ mobile, purpose }).expect(200);
    const logged = logSpy.mock.calls.map((a) => String(a[0])).find((l) => l.includes(mobile));
    const code = /code=(\d{4})(?!\d)/.exec(logged ?? '')?.[1];
    logSpy.mockRestore();
    const verify = await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId: req.body.otpId, code, deviceId: 'e2e-care' })
      .expect(200);
    return verify.body.accessToken;
  }

  async function verifiedDentist(): Promise<{ token: string; dentistId: string; clinicId: string }> {
    const token = await verifiedToken(freshMobile('98'), 'dentist');
    const app1 = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'E2E Care Dentist',
        qualification: 'BDS',
        specialization: 'General Dentist',
        councilRegNo: `CARE-E2E-${Date.now()}`,
        primaryClinicName: 'E2E Care Clinic',
        offersVideo: true,
        feeVideoPaise: 40000,
        feeClinicPaise: 50000,
        termsConsent: true,
        telemedicineConsent: true,
      })
      .expect(201);
    const dentistId = app1.body.id;
    await pool.query("update dentists set status = 'verified' where user_id = $1", [dentistId]);
    const clinics = await request(app.getHttpServer())
      .get('/dentists/me/clinics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return { token, dentistId, clinicId: clinics.body[0].id };
  }

  async function registeredPatient(allergies?: string): Promise<{ token: string; patientId: string }> {
    const token = await verifiedToken(freshMobile('97'), 'patient');
    const reg = await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'E2E Care Patient', dateOfBirth: '1990-01-01', termsConsent: true, telemedicineConsent: true })
      .expect(201);
    if (allergies) {
      await request(app.getHttpServer())
        .patch('/patients/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ allergies })
        .expect(200);
    }
    return { token, patientId: reg.body.id };
  }

  async function signingChallenge(dentist: { token: string; dentistId: string }, appointmentId: string) {
    // Simulate waiting through the cooldown without sleeping or weakening production limits.
    await pool.query(
      `update otp_codes set created_at = now() - interval '31 seconds'
      where mobile = (select mobile from users where id = $1)`,
      [dentist.dentistId],
    );
    const logs = jest.spyOn(console, 'log').mockImplementation();
    try {
      const result = await request(app.getHttpServer())
        .post(`/appointments/${appointmentId}/prescription/otp`)
        .set('Authorization', `Bearer ${dentist.token}`)
        .expect(200);
      const line = logs.mock.calls.map((call) => String(call[0])).find((line) => line.includes('(prescription)'));
      const code = /code=(\d{4})(?!\d)/.exec(line ?? '')?.[1];
      expect(code).toMatch(/^\d{4}$/);
      expect(result.body).not.toHaveProperty('code');
      return { otpId: result.body.otpId, confirmationCode: code! };
    } finally {
      logs.mockRestore();
    }
  }

  async function inProgress(
    dentist: { token: string; dentistId: string; clinicId: string },
    patient: { token: string },
    time = '10:00',
  ) {
    const booked = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-06-15',
        time,
        concern: 'Integration test',
        paymentMethod: 'pay_at_clinic',
        idempotencyKey: crypto.randomUUID(),
      })
      .expect(201);
    await pool.query('update appointments set scheduled_date = current_date where id = $1', [booked.body.id]);
    await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/start`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/appointments/${booked.body.id}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({
        diagnosis: 'Test diagnosis',
        prescriptionItems: [
          { medicineName: 'Test medicine', dose: 'Test dose', frequency: 'Test frequency', duration: 'Test duration' },
        ],
      })
      .expect(200);
    return booked.body.id as string;
  }

  it('refuses a double-booked slot but replays an identical idempotency key instead of erroring', async () => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient();

    const book = (idempotencyKey: string, concern = 'Toothache') =>
      request(app.getHttpServer()).post('/appointments').set('Authorization', `Bearer ${patient.token}`).send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-01-15',
        time: '11:00',
        concern,
        // Doesn't need a real gateway order — this test only cares
        // about the double-booking/idempotency behavior. Only the
        // refund test below deliberately uses a real online method, to
        // keep this suite's hits to Razorpay's rate-limited test API
        // to a minimum.
        paymentMethod: 'pay_at_clinic',
        idempotencyKey,
      });

    const key1 = `idem-1-${Date.now()}`;
    const key2 = `idem-2-${Date.now()}`;

    const first = await book(key1).expect(201);

    await book(key2, 'Different concern, same slot').expect(409);

    const replay = await book(key1).expect(201);
    expect(replay.body.id).toBe(first.body.id); // same appointment, not a duplicate
  });

  it.each(['pay_at_clinic', 'upi'])('runs the full booked → consult → signed prescription → completed pipeline using %s, with the allergy check', async (paymentMethod) => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient('Penicillin');

    // "start" below requires scheduled_date <= today. Computing a
    // same-day slot from the wall clock (date.getHours()+1, clamped to
    // the day's video hours) was flaky: whenever the suite happened to
    // run inside the clamped hour's last 59 minutes (e.g. 23:16, with
    // hours ending 23:30), the clamped slot was already in the past by
    // the time slotHasPassed() checked it. Sidestep the clock entirely —
    // book a slot on a fixed, always-future date, then move the row to
    // today directly, which exercises the same "start" guard without
    // depending on what time it is when the suite runs.
    const booked = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        type: 'clinic',
        clinicId: dentist.clinicId,
        date: '2027-06-15',
        time: '10:00',
        concern: 'Follow-up',
        paymentMethod,
        idempotencyKey: `idem-${Date.now()}`,
      })
      .expect(201);
    const appointmentId = booked.body.id;
    expect(booked.body.status).toBe('booked');
    expect(booked.body.payment.status).toBe(paymentMethod === 'upi' ? 'pending' : 'due_at_clinic');
    if (paymentMethod === 'upi') await simulateCapture(booked.body.payment.gatewayOrderId);
    const schedule = await request(app.getHttpServer())
      .get('/appointments?date=2027-06-15')
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    expect(schedule.body.items.map((a: { id: string }) => a.id)).toContain(appointmentId);
    await request(app.getHttpServer())
      .get(`/appointments/${appointmentId}/consultation`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/start`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(409);
    await pool.query('update appointments set scheduled_date = current_date where id = $1', [appointmentId]);

    const checkedIn = await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/check-in`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    expect(checkedIn.body.status).toBe('waiting');
    const waiting = await request(app.getHttpServer())
      .get(`/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    expect(waiting.body.status).toBe('waiting');
    expect(waiting.body.payment.status).toBe(paymentMethod === 'upi' ? 'paid' : 'due_at_clinic');

    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/start`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .put(`/appointments/${appointmentId}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({
        chiefComplaint: 'Test visit concern',
        findings: 'Test examination findings',
        diagnosis: 'Dentine hypersensitivity',
        chart: [{ toothNumber: '24', status: 'caries' }],
        prescriptionItems: [{ medicineName: 'Amoxicillin', dose: '1 capsule', frequency: 'TID', duration: '5 days' }],
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/consultation/complete`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(422); // unsigned prescription with items present

    const unpublishedChart = await request(app.getHttpServer())
      .get('/patients/me/chart')
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    expect(unpublishedChart.body).toEqual([]);
    jest.spyOn(otpHash, 'generateOtpCode').mockReturnValueOnce('0123');
    const challenge = await signingChallenge(dentist, appointmentId);
    expect(challenge.confirmationCode).toBe('0123');
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ ...challenge, confirmationCode: '123456', allergyOverrideAck: true })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send(challenge)
      .expect(422); // allergy conflict, not acknowledged

    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({
        ...challenge,
        confirmationCode: challenge.confirmationCode === '0000' ? '0001' : '0000',
        allergyOverrideAck: true,
      })
      .expect(422);
    expect((await pool.query('select attempts from otp_codes where id = $1', [challenge.otpId])).rows[0].attempts).toBe(
      1,
    );

    const signed = await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ ...challenge, allergyOverrideAck: true })
      .expect(200);
    expect(signed.body.prescription.signedAt).toBeTruthy();

    // Dentist Web saves notes immediately before completion. It must omit the immutable medicine list.
    await request(app.getHttpServer())
      .put(`/appointments/${appointmentId}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ plan: 'Test follow-up plan', followUpDate: '2027-06-30' })
      .expect(200);

    const completed = await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/consultation/complete`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    expect(completed.body.status).toBe('completed');

    const patientVisit = await request(app.getHttpServer())
      .get(`/appointments/${appointmentId}/consultation`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    expect(patientVisit.body).toMatchObject({
      chiefComplaint: 'Test visit concern',
      findings: 'Test examination findings',
      diagnosis: 'Dentine hypersensitivity',
      plan: 'Test follow-up plan',
      followUpDate: '2027-06-30',
      prescription: {
        signedAt: signed.body.prescription.signedAt,
        signedByDentistId: dentist.dentistId,
        items: [expect.objectContaining({ medicineName: 'Amoxicillin' })],
      },
    });
    for (const token of [patient.token, dentist.token]) {
      const history = await request(app.getHttpServer())
        .get('/appointments?status=completed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(history.body.items.find((a: { id: string }) => a.id === appointmentId)?.status).toBe('completed');
    }
    await request(app.getHttpServer())
      .put(`/appointments/${appointmentId}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ diagnosis: 'Overwritten' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/otp`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(409);

    const chart = await pool.query('select * from patient_current_chart where patient_id = $1', [patient.patientId]);
    expect(chart.rows.find((r) => r.tooth_number === '24')?.status).toBe('caries');
    const publishedChart = await request(app.getHttpServer())
      .get('/patients/me/chart')
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    expect(publishedChart.body).toContainEqual(expect.objectContaining({ toothNumber: '24', status: 'caries' }));
  });

  it('binds signing codes to the dentist, appointment and medicine list, and consumes them only once', async () => {
    const dentist = await verifiedDentist();
    const otherDentist = await verifiedDentist();
    const patient = await registeredPatient();
    const first = await inProgress(dentist, patient);
    const second = await inProgress(dentist, patient, '11:00');
    const other = await inProgress(otherDentist, patient);
    const challenge = await signingChallenge(dentist, first);
    const mobile = (await pool.query('select mobile from users where id = $1', [dentist.dentistId])).rows[0].mobile;
    const loginChallenge = await app.get(OtpService).create(mobile, 'dentist');
    await request(app.getHttpServer())
      .post(`/appointments/${first}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ otpId: loginChallenge.otpId, confirmationCode: loginChallenge.code })
      .expect(422);
    await request(app.getHttpServer())
      .post('/auth/otp/verify')
      .send({ otpId: challenge.otpId, code: challenge.confirmationCode, deviceId: 'not-a-login-challenge' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/appointments/${second}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send(challenge)
      .expect(422);
    await request(app.getHttpServer())
      .post(`/appointments/${other}/prescription/sign`)
      .set('Authorization', `Bearer ${otherDentist.token}`)
      .send(challenge)
      .expect(422);
    await request(app.getHttpServer())
      .post(`/appointments/${first}/prescription/otp`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/appointments/${first}/prescription/otp`)
      .set('Authorization', `Bearer ${otherDentist.token}`)
      .expect(404);
    await request(app.getHttpServer())
      .put(`/appointments/${first}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({
        prescriptionItems: [
          { medicineName: 'Changed test medicine', dose: 'Test', frequency: 'Test', duration: 'Test' },
        ],
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/appointments/${first}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send(challenge)
      .expect(422);
    expect(
      (await pool.query('select consumed_at from otp_codes where id = $1', [challenge.otpId])).rows[0].consumed_at,
    ).toBeNull();
    const fresh = await signingChallenge(dentist, first);
    const results = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .post(`/appointments/${first}/prescription/sign`)
          .set('Authorization', `Bearer ${dentist.token}`)
          .send(fresh),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    await request(app.getHttpServer())
      .put(`/appointments/${first}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ prescriptionItems: [] })
      .expect(409);
  });

  it('expires signing codes and persists the five-attempt lockout', async () => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient();
    const appointmentId = await inProgress(dentist, patient);
    const expired = await signingChallenge(dentist, appointmentId);
    await pool.query("update otp_codes set expires_at = now() - interval '1 second' where id = $1", [expired.otpId]);
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send(expired)
      .expect(410);
    const challenge = await signingChallenge(dentist, appointmentId);
    const wrong = challenge.confirmationCode === '0000' ? '0001' : '0000';
    for (let attempt = 1; attempt <= 5; attempt++) {
      await request(app.getHttpServer())
        .post(`/appointments/${appointmentId}/prescription/sign`)
        .set('Authorization', `Bearer ${dentist.token}`)
        .send({ ...challenge, confirmationCode: wrong })
        .expect(attempt === 5 ? 423 : 422);
    }
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/sign`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send(challenge)
      .expect(423);
    expect(
      (await pool.query('select signed_at from prescriptions where appointment_id = $1', [appointmentId])).rows[0]
        .signed_at,
    ).toBeNull();
  });

  it('completes a visit without medicines and keeps cancelled appointments read-only', async () => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient();
    const appointmentId = await inProgress(dentist, patient);
    await request(app.getHttpServer())
      .put(`/appointments/${appointmentId}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ prescriptionItems: [] })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/prescription/otp`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(409);
    await request(app.getHttpServer())
      .post(`/appointments/${appointmentId}/consultation/complete`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    const visit = await request(app.getHttpServer())
      .get(`/appointments/${appointmentId}/consultation`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    expect(visit.body.prescription.items).toEqual([]);
    const updates = await request(app.getHttpServer()).get('/notifications')
      .set('Authorization', `Bearer ${patient.token}`).expect(200);
    expect(updates.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'visit_summary_ready', appointmentId }),
    ]));
    const cancelled = await inProgress(dentist, patient, '12:00');
    await request(app.getHttpServer())
      .post(`/appointments/${cancelled}/cancel`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/appointments/${cancelled}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ diagnosis: 'Cannot edit' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/appointments/${cancelled}/prescription/otp`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(409);
  });

  it('refunds a paid cancellation and frees the slot for rebooking', async () => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient();

    const booked = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-02-01',
        time: '15:00',
        concern: 'Checkup',
        paymentMethod: 'upi',
        idempotencyKey: `idem-cancel-${Date.now()}`,
      })
      .expect(201);
    expect(booked.body.payment.status).toBe('pending'); // real order created; not captured yet
    expect(booked.body.payment.gatewayOrderId).toBeTruthy();

    // Only a captured ('paid') transaction is ever refunded — simulate
    // Razorpay confirming the payment before cancelling.
    await simulateCapture(booked.body.payment.gatewayOrderId);

    const refundSpy = jest.spyOn(gateway, 'refund');

    const cancelled = await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/cancel`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    expect(refundSpy).not.toHaveBeenCalled();
    refundSpy.mockRestore();
    expect(cancelled.body.payment.status).toBe('refund_pending');
    const queued = await pool.query('select * from payment_refunds where transaction_id = (select id from transactions where appointment_id = $1)', [booked.body.id]);
    expect(queued.rows).toHaveLength(1);

    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-02-01',
        time: '15:00',
        concern: 'Rebooked',
        paymentMethod: 'pay_at_clinic',
        idempotencyKey: `idem-rebook-${Date.now()}`,
      })
      .expect(201);
  });

  it('reschedules a booked appointment to a free slot, but refuses one already taken or already in the past', async () => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient();

    const booked = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-04-01',
        time: '11:00',
        concern: 'Reschedule me',
        paymentMethod: 'pay_at_clinic', // reschedule mechanics, not payment, is the focus here
        idempotencyKey: `idem-reschedule-${Date.now()}`,
      })
      .expect(201);

    const rescheduled = await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ date: '2027-04-02', time: '12:00' })
      .expect(200);
    expect(rescheduled.body.date).toBe('2027-04-02');
    expect(rescheduled.body.time).toBe('12:00');

    // A past date/time is refused outright.
    await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ date: '2020-01-01', time: '09:00' })
      .expect(400);

    // A second appointment already sitting on the target slot blocks the move.
    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-04-03',
        time: '13:00',
        concern: 'Occupies the target slot',
        paymentMethod: 'pay_at_clinic',
        idempotencyKey: `idem-reschedule-blocker-${Date.now()}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ date: '2027-04-03', time: '13:00' })
      .expect(409);

    // Cancel, then rescheduling the (now cancelled) appointment is refused.
    await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/cancel`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ date: '2027-04-04', time: '14:00' })
      .expect(409);
  });

  it('keeps appointments and their actions scoped to the patient or dentist who own them', async () => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient();
    const otherPatient = await registeredPatient();

    const booked = await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-03-01',
        time: '10:00',
        concern: 'Ownership test',
        paymentMethod: 'pay_at_clinic',
        idempotencyKey: `idem-own-${Date.now()}`,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/appointments/${booked.body.id}`)
      .set('Authorization', `Bearer ${otherPatient.token}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/check-in`)
      .set('Authorization', `Bearer ${patient.token}`)
      .expect(403); // patient token, dentist-only route
  });

  it('checks in only booked clinic visits scheduled for today', async () => {
    const dentist = await verifiedDentist();
    const patient = await registeredPatient();
    const booked = await request(app.getHttpServer()).post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`).send({
        dentistId: dentist.dentistId, clinicId: dentist.clinicId, type: 'clinic',
        date: '2027-06-15', time: '11:00', concern: 'Arrival check', paymentMethod: 'pay_at_clinic',
        idempotencyKey: crypto.randomUUID(),
      }).expect(201);
    const arrive = () => request(app.getHttpServer()).post(`/appointments/${booked.body.id}/check-in`)
      .set('Authorization', `Bearer ${dentist.token}`);
    await arrive().expect(409);
    await pool.query("update appointments set scheduled_date = current_date - 1 where id = $1", [booked.body.id]);
    await arrive().expect(409);
    await pool.query('update appointments set scheduled_date = current_date where id = $1', [booked.body.id]);
    expect((await arrive().expect(200)).body.status).toBe('waiting');
    await arrive().expect(409);
    await pool.query("update appointments set type = 'video', clinic_id = null, status = 'booked' where id = $1", [booked.body.id]);
    await arrive().expect(409);
  });

  it('reschedules for the treating dentist without overwriting a newer schedule or changing the clinic/payment', async () => {
    const dentist = await verifiedDentist();
    const other = await verifiedDentist();
    const patient = await registeredPatient();
    const booked = await request(app.getHttpServer()).post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`).send({
        dentistId: dentist.dentistId, clinicId: dentist.clinicId, type: 'clinic',
        date: '2027-04-01', time: '11:00', concern: 'Dentist reschedule', paymentMethod: 'pay_at_clinic',
        idempotencyKey: crypto.randomUUID(),
      }).expect(201);
    const move = (body: Record<string, unknown>, token = dentist.token) => request(app.getHttpServer())
      .post(`/appointments/${booked.body.id}/reschedule`).set('Authorization', `Bearer ${token}`).send(body);
    const target = { date: '2027-04-02', time: '12:00', expectedDate: '2027-04-01', expectedTime: '11:00' };
    await move(target, other.token).expect(404);
    const moved = await move(target).expect(200);
    expect(moved.body).toMatchObject({ date: target.date, time: target.time, clinicId: booked.body.clinicId, clinicName: 'E2E Care Clinic', payment: booked.body.payment });
    await move(target).expect(200); // Lost-response retry: the target is already applied.
    await move({ ...target, time: '13:00' }).expect(409); // Original schedule is stale.
    for (const invalid of [
      { date: '2027-02-29', time: '12:00' }, { date: '2027-04-03T00:00:00Z', time: '12:00' },
      { date: '2027-04-03', time: '12:00', expectedDate: '2027-04-02' },
      { date: '2027-04-03', time: '12:00', expectedTime: '12:00' },
    ]) await move(invalid).expect(400);
    const unchanged = await request(app.getHttpServer()).get(`/appointments/${booked.body.id}`)
      .set('Authorization', `Bearer ${dentist.token}`).expect(200);
    expect(unchanged.body).toMatchObject({ date: target.date, time: target.time, payment: booked.body.payment });
  });

  it("lists a dentist's own patients and one patient's full record, scoped to an actual appointment relationship", async () => {
    const dentist = await verifiedDentist();
    const otherDentist = await verifiedDentist();
    const patient = await registeredPatient('Penicillin');
    const strangerPatient = await registeredPatient();

    await request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        dentistId: dentist.dentistId,
        clinicId: dentist.clinicId,
        type: 'clinic',
        date: '2027-06-01',
        time: '11:00',
        concern: 'Patient record check',
        paymentMethod: 'pay_at_clinic',
        idempotencyKey: `idem-patients-${Date.now()}`,
      })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/dentists/me/patients')
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    const found = list.body.find((p: { id: string }) => p.id === patient.patientId);
    expect(found).toBeTruthy();
    expect(found.fullName).toBe('E2E Care Patient');
    expect(found.visitCount).toBe(0); // booked, not yet completed
    expect(found.lastVisitDate).toBeNull();
    expect(list.body.some((p: { id: string }) => p.id === strangerPatient.patientId)).toBe(false);

    const record = await request(app.getHttpServer())
      .get(`/dentists/me/patients/${patient.patientId}`)
      .set('Authorization', `Bearer ${dentist.token}`)
      .expect(200);
    expect(record.body.fullName).toBe('E2E Care Patient');
    expect(record.body.allergies).toBe('Penicillin');
    expect(record.body.appointments).toHaveLength(1);
    expect(record.body.appointments[0].concern).toBe('Patient record check');

    // A dentist who has never treated this patient gets the same 404 an
    // unrelated appointment owner would — existence isn't revealed either way.
    await request(app.getHttpServer())
      .get(`/dentists/me/patients/${patient.patientId}`)
      .set('Authorization', `Bearer ${otherDentist.token}`)
      .expect(404);

    await request(app.getHttpServer()).get('/dentists/me/patients').expect(401);
  });

  it('returns calendar dates, guardian details, current teeth and only the calling dentist\'s visit history', async () => {
    const dentist = await verifiedDentist();
    const other = await verifiedDentist();
    const patient = await registeredPatient('Penicillin');
    await pool.query(
      `update patients set date_of_birth = '2014-06-15', city = 'Test city',
         guardian_name = 'Test guardian', guardian_relationship = 'Parent',
         guardian_mobile = '+919000000001', guardian_consent_at = now()
       where user_id = $1`,
      [patient.patientId],
    );
    async function visit(doctor: typeof dentist, date: string, time: string, status: string) {
      const { rows } = await pool.query(
        `insert into appointments (patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time, status, concern_summary)
         values ($1,$2,$3,'clinic',$4,$5,$6::appointment_status,'Test history concern') returning id`,
        [patient.patientId, doctor.dentistId, doctor.clinicId, date, time, status],
      );
      return rows[0].id as string;
    }
    const first = await visit(dentist, '2026-10-01', '09:00', 'completed');
    const latest = await visit(dentist, '2026-10-12', '10:30', 'completed');
    const upcoming = await visit(dentist, '2026-10-25', '11:00', 'booked');
    const unrelated = await visit(other, '2026-10-15', '12:00', 'completed');
    await pool.query(
      `insert into consultations (appointment_id, diagnosis, plan, plan_items)
       values ($1,'Test history diagnosis','Test advice',$2::jsonb)`,
      [latest, JSON.stringify([{ procedure: 'Test procedure', teeth: ['36'], estimatedCostPaise: 12345 }])],
    );
    await pool.query(
      `insert into dental_chart_entries (patient_id,tooth_number,status,recorded_by_dentist_id,appointment_id)
       values ($1,'36','filled',$2,$3)`,
      [patient.patientId, dentist.dentistId, latest],
    );

    const roster = await request(app.getHttpServer()).get('/dentists/me/patients')
      .set('Authorization', `Bearer ${dentist.token}`).expect(200);
    const summaries = roster.body.filter((row: { id: string }) => row.id === patient.patientId);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ visitCount: 2, lastVisitDate: '2026-10-12', hasAllergies: true });

    const record = await request(app.getHttpServer()).get(`/dentists/me/patients/${patient.patientId}`)
      .set('Authorization', `Bearer ${dentist.token}`).expect(200);
    expect(record.body).toMatchObject({
      dateOfBirth: '2014-06-15', city: 'Test city', allergies: 'Penicillin', hasAllergies: true,
      guardian: { name: 'Test guardian', relationship: 'Parent', mobile: '+919000000001' },
    });
    expect(record.body.age).toBeLessThan(18);
    expect(record.body.chart).toEqual([expect.objectContaining({ toothNumber: '36', status: 'filled' })]);
    expect(record.body.appointments.map((row: { id: string }) => row.id)).toEqual([upcoming, latest, first]);
    expect(record.body.appointments).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: unrelated })]));
    expect(record.body.appointments[1]).toMatchObject({
      date: '2026-10-12', time: '10:30', type: 'clinic', clinicName: 'E2E Care Clinic', diagnosis: 'Test history diagnosis',
    });
    const consultation = await request(app.getHttpServer()).get(`/appointments/${latest}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`).expect(200);
    expect(consultation.body.planItems[0].procedure).toBe('Test procedure');
    await request(app.getHttpServer()).get(`/appointments/${unrelated}/consultation`)
      .set('Authorization', `Bearer ${dentist.token}`).expect(404);
  });

  it('keeps records private to verified related dentists and validates patient IDs', async () => {
    const dentist = await verifiedDentist();
    const other = await verifiedDentist();
    const patient = await registeredPatient();
    await pool.query(
      `insert into appointments (patient_id,dentist_id,clinic_id,type,scheduled_date,scheduled_time,status,concern_summary)
       values ($1,$2,$3,'clinic','2026-10-24','10:00','booked','Test scoped patient')`,
      [patient.patientId, dentist.dentistId, dentist.clinicId],
    );
    const roster = await request(app.getHttpServer()).get('/dentists/me/patients')
      .set('Authorization', `Bearer ${dentist.token}`).expect(200);
    expect(roster.body.find((row: { id: string }) => row.id === patient.patientId).hasAllergies).toBe(false);
    await request(app.getHttpServer()).get(`/dentists/me/patients/${patient.patientId}`)
      .set('Authorization', `Bearer ${other.token}`).expect(404);
    await request(app.getHttpServer()).get(`/dentists/me/patients/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${dentist.token}`).expect(404);
    await request(app.getHttpServer()).get('/dentists/me/patients/not-a-uuid')
      .set('Authorization', `Bearer ${dentist.token}`).expect(400);
    await request(app.getHttpServer()).get(`/dentists/me/patients/${patient.patientId}`)
      .set('Authorization', `Bearer ${patient.token}`).expect(403);
    await request(app.getHttpServer()).get(`/dentists/me/patients/${patient.patientId}`).expect(401);
    await pool.query("update dentists set status = 'disabled' where user_id = $1", [dentist.dentistId]);
    await request(app.getHttpServer()).get(`/dentists/me/patients/${patient.patientId}`)
      .set('Authorization', `Bearer ${dentist.token}`).expect(403);
  });
});
