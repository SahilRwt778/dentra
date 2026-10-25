import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import { randomInt, randomUUID } from 'node:crypto';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { AuditService } from '../../src/modules/admin/audit/audit.service';
import { RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';

describe('Clinic payment collection (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService;
  type Actor = { id: string; token: string; clinicId: string };
  const input = (method = 'cash', amountPaise = 50029) => ({
    requestId: randomUUID(),
    amountPaise,
    method,
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    jwt = app.get(JwtService);
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });
  async function actor(
    role: 'dentist' | 'patient' | 'admin',
    status = 'verified',
  ): Promise<Actor> {
    const id = randomUUID();
    await pool.query(
      'insert into users (id, role, mobile, email, password_hash) values ($1,$2,$3,$4,$5)',
      [
        id,
        role,
        role === 'admin' ? null : `+91${randomInt(6000000000, 9999999999)}`,
        role === 'admin' ? `collection-${id}@example.test` : null,
        role === 'admin' ? 'synthetic-only' : null,
      ],
    );
    let clinicId = '';
    if (role === 'dentist') {
      await pool.query(
        `insert into dentists (user_id, full_name, qualification, specialization, council_reg_no, status)
        values ($1,'Collection Test Dentist','BDS','General','COLLECTION-TEST',$2)`,
        [id, status],
      );
      clinicId = (
        await pool.query(
          "insert into dentist_clinics (dentist_id, name) values ($1,'Collection Test Clinic') returning id",
          [id],
        )
      ).rows[0].id;
    } else if (role === 'patient') {
      await pool.query(
        "insert into patients (user_id, full_name, date_of_birth) values ($1,'Collection Test Patient','1990-01-01')",
        [id],
      );
    }
    return { id, clinicId, token: jwt.sign({ sub: id, role }) };
  }
  async function fixture(
    status = 'booked',
    paymentMethod = 'pay_at_clinic',
    paymentStatus = 'due_at_clinic',
    amount = 50029,
  ) {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    const appointmentId = (
      await pool.query(
        `insert into appointments (patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time, concern_summary, status)
      values ($1,$2,$3,'clinic','2027-07-22','10:00','Collection fixture',$4) returning id`,
        [patient.id, dentist.id, dentist.clinicId, status],
      )
    ).rows[0].id;
    const transactionId = (
      await pool.query(
        `insert into transactions (appointment_id, idempotency_key, amount_paise, method, status, gateway_ref, gateway_payment_ref)
      values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [
          appointmentId,
          randomUUID(),
          amount,
          paymentMethod,
          paymentStatus,
          paymentMethod === 'pay_at_clinic' ? null : `order_${randomUUID()}`,
          paymentStatus === 'paid' && paymentMethod !== 'pay_at_clinic'
            ? `pay_${randomUUID()}`
            : null,
        ],
      )
    ).rows[0].id;
    return { dentist, patient, appointmentId, transactionId };
  }
  const get = (user: Actor, path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${user.token}`);
  const post = (user: Actor, path: string, body: object = {}) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);
  const collect = (user: Actor, id: string, body = input()) =>
    post(user, `/appointments/${id}/clinic-payment`, body);

  it.each(['cash', 'upi', 'card'])(
    'records %s once and shares the exact amount, method and receipt time with patient and admin',
    async (method) => {
      const f = await fixture(),
        admin = await actor('admin'),
        body = input(method);
      const createOrder = jest.spyOn(
        app.get(RazorpayGatewayService),
        'createOrder',
      );
      const response = await collect(f.dentist, f.appointmentId, body).expect(
        200,
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body.payment).toMatchObject({
        status: 'paid',
        method: 'pay_at_clinic',
        amountPaise: 50029,
        gatewayOrderId: null,
        collection: { id: body.requestId, method, amountPaise: 50029 },
      });
      expect(
        Number.isNaN(Date.parse(response.body.payment.collection.collectedAt)),
      ).toBe(false);
      expect(createOrder).not.toHaveBeenCalled();
      const patient = await get(
        f.patient,
        `/appointments/${f.appointmentId}`,
      ).expect(200);
      expect(patient.body.payment.collection).toEqual(
        response.body.payment.collection,
      );
      const report = await get(
        admin,
        `/admin/payments?q=${f.appointmentId}&status=paid`,
      ).expect(200);
      expect(report.body.summary.paidAmountPaise).toBe(50029);
      expect(report.body.summary.dueAtClinicAmountPaise).toBe(0);
      expect(report.body.items[0].collection).toEqual(
        response.body.payment.collection,
      );
      const appointments = await get(
        admin,
        '/admin/appointments?from=2027-07-22&to=2027-07-22&limit=100',
      ).expect(200);
      expect(
        appointments.body.items.find(
          (item: { id: string }) => item.id === f.appointmentId,
        ).payment.collection,
      ).toEqual(response.body.payment.collection);
      const audit = await pool.query(
        'select * from audit_log where entity_id = $1 and action = $2',
        [f.appointmentId, 'clinic_payment_recorded'],
      );
      expect(audit.rows).toHaveLength(1);
      expect(audit.rows[0]).toMatchObject({
        actor_user_id: f.dentist.id,
        after_state: { status: 'paid', amountPaise: 50029, method },
      });
    },
  );

  it('allows completed visits and zero-fee visits without changing booked amounts or methods', async () => {
    for (const [status, fee] of [
      ['completed', 50029],
      ['waiting', 0],
      ['in_consult', 50029],
    ] as const) {
      const f = await fixture(status, 'pay_at_clinic', 'due_at_clinic', fee);
      const result = await collect(
        f.dentist,
        f.appointmentId,
        input('cash', fee),
      ).expect(200);
      expect(result.body.status).toBe(status);
      expect(result.body.payment.amountPaise).toBe(fee);
      expect(result.body.payment.method).toBe('pay_at_clinic');
    }
  });

  it('requires the treating verified dentist and valid input, leaving rejected requests unchanged', async () => {
    const f = await fixture(),
      other = await actor('dentist'),
      admin = await actor('admin');
    await request(app.getHttpServer())
      .post(`/appointments/${f.appointmentId}/clinic-payment`)
      .send(input())
      .expect(401);
    await collect(f.patient, f.appointmentId).expect(403);
    await collect(admin, f.appointmentId).expect(403);
    await collect(other, f.appointmentId).expect(404);
    for (const changes of [
      { method: 'netbanking' },
      { method: null },
      { amountPaise: -1 },
      { amountPaise: 1.5 },
      { amountPaise: '50029' },
      { amountPaise: 2147483648 },
      { requestId: 'invalid' },
      { collectedBy: other.id },
    ]) {
      await collect(f.dentist, f.appointmentId, {
        ...input(),
        ...changes,
      } as never).expect(400);
    }
    await collect(f.dentist, f.appointmentId, input('cash', 50000)).expect(409);
    await pool.query(
      "update dentists set status = 'disabled' where user_id = $1",
      [f.dentist.id],
    );
    await collect(f.dentist, f.appointmentId).expect(403);
    expect(
      (
        await pool.query(
          'select status, amount_paise from transactions where id = $1',
          [f.transactionId],
        )
      ).rows[0],
    ).toEqual({ status: 'due_at_clinic', amount_paise: 50029 });
    expect(
      (
        await pool.query(
          'select 1 from clinic_payment_collections where transaction_id = $1',
          [f.transactionId],
        )
      ).rowCount,
    ).toBe(0);
  });

  it('rejects cancelled, video, gateway and no-longer-due payments', async () => {
    const cancelled = await fixture('cancelled');
    await collect(cancelled.dentist, cancelled.appointmentId).expect(409);
    for (const status of ['pending', 'paid', 'failed', 'refunded']) {
      const online = await fixture('booked', 'upi', status);
      await collect(online.dentist, online.appointmentId).expect(409);
    }
    const video = await fixture();
    await pool.query(
      "update appointments set type = 'video', clinic_id = null where id = $1",
      [video.appointmentId],
    );
    await collect(video.dentist, video.appointmentId).expect(409);
    const notDue = await fixture('booked', 'pay_at_clinic', 'cancelled');
    await collect(notDue.dentist, notDue.appointmentId).expect(409);
  });

  it('replays an identical request, rejects changed details and prevents concurrent duplicate receipts', async () => {
    const f = await fixture(),
      body = input('upi');
    const results = await Promise.all([
      collect(f.dentist, f.appointmentId, body),
      collect(f.dentist, f.appointmentId, body),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results[0].body.payment.collection).toEqual(
      results[1].body.payment.collection,
    );
    await collect(f.dentist, f.appointmentId, {
      ...body,
      method: 'cash',
    }).expect(409);
    await collect(f.dentist, f.appointmentId, input()).expect(409);
    expect(
      (
        await pool.query(
          'select 1 from clinic_payment_collections where transaction_id = $1',
          [f.transactionId],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "select 1 from audit_log where entity_id = $1 and action = 'clinic_payment_recorded'",
          [f.appointmentId],
        )
      ).rowCount,
    ).toBe(1);
    const second = await fixture();
    await collect(second.dentist, second.appointmentId, body).expect(409);
    expect(
      (
        await get(
          second.patient,
          `/appointments/${second.appointmentId}`,
        ).expect(200)
      ).body.payment.status,
    ).toBe('due_at_clinic');
  });

  it('keeps the receipt paid when cancelling and never queues an online refund', async () => {
    const f = await fixture(),
      body = input('card');
    await collect(f.dentist, f.appointmentId, body).expect(200);
    const cancelled = await post(
      f.patient,
      `/appointments/${f.appointmentId}/cancel`,
    ).expect(200);
    expect(cancelled.body).toMatchObject({
      status: 'cancelled',
      payment: { status: 'paid', collection: { id: body.requestId } },
    });
    expect(
      (
        await pool.query(
          'select 1 from payment_refunds where transaction_id = $1',
          [f.transactionId],
        )
      ).rowCount,
    ).toBe(0);
    await collect(f.dentist, f.appointmentId, body).expect(200);
  });

  it('serializes collection and cancellation, never recording a receipt after cancellation', async () => {
    const f = await fixture();
    const [collected, cancelled] = await Promise.all([
      collect(f.dentist, f.appointmentId),
      post(f.patient, `/appointments/${f.appointmentId}/cancel`),
    ]);
    expect(cancelled.status).toBe(200);
    expect([200, 409]).toContain(collected.status);
    const current = (
      await get(f.patient, `/appointments/${f.appointmentId}`).expect(200)
    ).body;
    expect(current.status).toBe('cancelled');
    expect(current.payment.status).toBe(
      collected.status === 200 ? 'paid' : 'cancelled',
    );
    expect(!!current.payment.collection).toBe(collected.status === 200);
  });

  it('rolls back both receipt and payment if audit logging fails', async () => {
    const f = await fixture();
    jest
      .spyOn(app.get(AuditService), 'log')
      .mockRejectedValueOnce(new Error('Synthetic audit failure'));
    await collect(f.dentist, f.appointmentId).expect(500);
    expect(
      (await get(f.patient, `/appointments/${f.appointmentId}`).expect(200))
        .body.payment,
    ).toMatchObject({ status: 'due_at_clinic', collection: null });
    expect(
      (
        await pool.query(
          'select 1 from clinic_payment_collections where transaction_id = $1',
          [f.transactionId],
        )
      ).rowCount,
    ).toBe(0);
  });
});
