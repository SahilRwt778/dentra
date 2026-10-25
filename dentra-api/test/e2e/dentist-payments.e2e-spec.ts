import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

describe('Dentist payments reporting (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService;
  type Actor = { id: string; token: string; clinicId: string };
  type Fixture = {
    id: string;
    appointmentId: string;
    receiptId: string | null;
  };
  const path = '/dentists/me/payments';
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
        role === 'admin' ? `report-${id}@example.test` : null,
        role === 'admin' ? 'synthetic-only' : null,
      ],
    );
    let clinicId = '';
    if (role === 'dentist') {
      await pool.query(
        `insert into dentists (user_id, full_name, qualification, specialization, council_reg_no, status)
        values ($1,'Report Test Dentist','BDS','General','REPORT-TEST',$2)`,
        [id, status],
      );
      clinicId = (
        await pool.query(
          "insert into dentist_clinics (dentist_id, name) values ($1,'Report Test Clinic') returning id",
          [id],
        )
      ).rows[0].id;
    } else if (role === 'patient') {
      await pool.query(
        "insert into patients (user_id, full_name, date_of_birth) values ($1,'Report Test Patient','1990-01-01')",
        [id],
      );
    }
    return { id, clinicId, token: jwt.sign({ sub: id, role }) };
  }
  async function payment(
    dentist: Actor,
    patient: Actor,
    options: {
      status?: string;
      clinic?: boolean;
      amount?: number;
      date?: string;
      collectedAt?: string;
      name?: string;
    } = {},
  ): Promise<Fixture> {
    const status = options.status ?? 'paid',
      clinic = options.clinic ?? false;
    const amount = options.amount ?? 50029;
    const appointmentId = (
      await pool.query(
        `insert into appointments
      (patient_id, dentist_id, clinic_id, type, scheduled_date, scheduled_time, concern_summary, status)
      values ($1,$2,$3,$4,'2027-07-22','10:00','Private fixture concern','cancelled') returning id`,
        [
          patient.id,
          dentist.id,
          clinic ? dentist.clinicId : null,
          clinic ? 'clinic' : 'video',
        ],
      )
    ).rows[0].id;
    const id = (
      await pool.query(
        `insert into transactions
      (appointment_id, idempotency_key, amount_paise, method, status, gateway_ref, gateway_payment_ref, created_at)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          appointmentId,
          randomUUID(),
          amount,
          clinic ? 'pay_at_clinic' : 'upi',
          status,
          clinic ? null : `order_${randomUUID()}`,
          !clinic &&
          ['paid', 'refunded', 'refund_pending', 'refund_failed'].includes(
            status,
          )
            ? `pay_${randomUUID()}`
            : null,
          options.date ?? '2026-10-20T12:00:00Z',
        ],
      )
    ).rows[0].id;
    let receiptId: string | null = null;
    if (clinic && status === 'paid') {
      receiptId = randomUUID();
      await pool.query(
        `insert into clinic_payment_collections (id, transaction_id, amount_paise, method, collected_by, collected_at)
        values ($1,$2,$3,'cash',$4,$5)`,
        [
          receiptId,
          id,
          amount,
          dentist.id,
          options.collectedAt ?? '2026-10-23T12:00:00Z',
        ],
      );
    }
    if (options.name)
      await pool.query(
        'update patients set full_name = $2 where user_id = $1',
        [patient.id, options.name],
      );
    return { id, appointmentId, receiptId };
  }
  const list = (user: Actor, query: object = {}) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${user.token}`)
      .query(query);
  const detail = (user: Actor, id: string) =>
    request(app.getHttpServer())
      .get(`${path}/${id}`)
      .set('Authorization', `Bearer ${user.token}`);

  it('requires the signed-in verified dentist and hides another dentist’s records and totals', async () => {
    const dentist = await actor('dentist'),
      other = await actor('dentist'),
      patient = await actor('patient'),
      admin = await actor('admin');
    const own = await payment(dentist, patient),
      privatePayment = await payment(other, patient, { amount: 999999 });
    await request(app.getHttpServer()).get(path).expect(401);
    await list(patient).expect(403);
    await list(admin).expect(403);
    await detail(other, own.id).expect(404);
    await detail(dentist, privatePayment.id).expect(404);
    await detail(dentist, randomUUID()).expect(404);
    const result = await list(dentist).expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.items.map((item: { id: string }) => item.id)).toEqual([
      own.id,
    ]);
    expect(result.body.summary.onlinePaidAmountPaise).toBe(50029);
    expect(result.body.summary.totalTransactions).toBe(1);
    await list(dentist, { dentistId: other.id }).expect(400);
    await pool.query(
      "update dentists set status = 'disabled' where user_id = $1",
      [dentist.id],
    );
    await list(dentist).expect(403);
    await detail(dentist, own.id).expect(403);
    const pending = await actor('dentist', 'pending_review');
    await list(pending).expect(403);
  });

  it('separates paid sources, outstanding and refund states with exact paise and no writes', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    await payment(dentist, patient, { amount: 10029 });
    const clinic = await payment(dentist, patient, {
      clinic: true,
      amount: 20029,
    });
    await payment(dentist, patient, {
      clinic: true,
      status: 'due_at_clinic',
      amount: 30029,
    });
    for (const [status, amount] of [
      ['pending', 40029],
      ['failed', 50029],
      ['refund_pending', 60029],
      ['refund_failed', 70029],
      ['refunded', 80029],
      ['cancelled', 90029],
    ] as const)
      await payment(dentist, patient, { status, amount });
    const before = await pool.query(
      'select * from transactions where appointment_id in (select id from appointments where dentist_id = $1) order by id',
      [dentist.id],
    );
    const result = await list(dentist).expect(200);
    expect(result.body.summary).toEqual({
      totalTransactions: 9,
      onlinePaidAmountPaise: 10029,
      clinicCollectedAmountPaise: 20029,
      dueAtClinicAmountPaise: 30029,
      pendingOnlineAmountPaise: 90058,
      refundPendingAmountPaise: 60029,
      refundFailedAmountPaise: 70029,
      refundedAmountPaise: 80029,
    });
    const receipt = await detail(dentist, clinic.id).expect(200);
    expect(receipt.headers['cache-control']).toBe('no-store');
    expect(receipt.body.collection).toEqual({
      id: clinic.receiptId,
      amountPaise: 20029,
      method: 'cash',
      collectedAt: '2026-10-23T12:00:00.000Z',
    });
    expect(receipt.body).toMatchObject({
      source: 'clinic',
      appointmentStatus: 'cancelled',
      appointmentDate: '2027-07-22',
      appointmentTime: '10:00',
    });
    expect(
      result.body.items.find((item: { id: string }) => item.id === clinic.id),
    ).toEqual(receipt.body);
    expect(JSON.stringify(result.body)).not.toMatch(
      /Private fixture concern|bankAccount|keySecret|refreshToken/,
    );
    expect(
      (
        await pool.query(
          'select * from transactions where appointment_id in (select id from appointments where dentist_id = $1) order by id',
          [dentist.id],
        )
      ).rows,
    ).toEqual(before.rows);
  });

  it('filters transaction creation dates at inclusive IST day boundaries, independently of receipt time', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    await payment(dentist, patient, { date: '2026-10-19T18:29:59Z' });
    const start = await payment(dentist, patient, {
      clinic: true,
      date: '2026-10-19T18:30:00Z',
      collectedAt: '2026-10-23T12:00:00Z',
    });
    const end = await payment(dentist, patient, {
      date: '2026-10-20T18:29:59Z',
    });
    await payment(dentist, patient, { date: '2026-10-20T18:30:00Z' });
    const result = await list(dentist, {
      from: '2026-10-20',
      to: '2026-10-20',
    }).expect(200);
    expect(
      result.body.items.map((item: { id: string }) => item.id).sort(),
    ).toEqual([start.id, end.id].sort());
    expect(result.body.summary.totalTransactions).toBe(2);
  });

  it('filters literal names and payment references, status and source while counting only matches', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    const clinic = await payment(dentist, patient, {
      clinic: true,
      name: 'Patient 100%_test',
    });
    await payment(dentist, patient, { status: 'pending' });
    expect(
      (
        await list(dentist, { source: 'clinic', status: 'paid' }).expect(200)
      ).body.items.map((item: { id: string }) => item.id),
    ).toEqual([clinic.id]);
    expect(
      (await list(dentist, { source: 'online' }).expect(200)).body.summary
        .clinicCollectedAmountPaise,
    ).toBe(0);
    for (const q of [
      clinic.id,
      clinic.appointmentId,
      clinic.receiptId,
      '  100%_test  ',
    ]) {
      const response = await list(dentist, { q, source: 'clinic' }).expect(200);
      expect(
        response.body.items.map((item: { id: string }) => item.id),
      ).toEqual([clinic.id]);
    }
    expect(
      (await list(dentist, { q: 'no-such-reference' }).expect(200)).body
        .summary,
    ).toEqual({
      totalTransactions: 0,
      onlinePaidAmountPaise: 0,
      clinicCollectedAmountPaise: 0,
      dueAtClinicAmountPaise: 0,
      pendingOnlineAmountPaise: 0,
      refundPendingAmountPaise: 0,
      refundFailedAmountPaise: 0,
      refundedAmountPaise: 0,
    });
  });

  it('paginates deterministically with adjustable limits and totals across all pages', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    for (let i = 0; i < 23; i++)
      await payment(dentist, patient, { amount: 10001 });
    const first = (await list(dentist).expect(200)).body,
      second = (await list(dentist, { page: 2 }).expect(200)).body;
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(3);
    expect(second.nextPage).toBeNull();
    expect(first.nextPage).toBe(2);
    expect(first.summary).toEqual(second.summary);
    expect(first.summary.onlinePaidAmountPaise).toBe(230023);
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(23);
    expect(ids).toEqual([...ids].sort().reverse());
    expect(
      (await list(dentist, { limit: 5 }).expect(200)).body.items,
    ).toHaveLength(5);
    const empty = (await list(dentist, { page: 3 }).expect(200)).body;
    expect(empty.items).toEqual([]);
    expect(empty.summary).toEqual(first.summary);
  });

  it('validates filters and keeps captured legacy payments classified as online', async () => {
    const dentist = await actor('dentist'),
      patient = await actor('patient');
    for (const query of [
      { page: 0 },
      { page: 'bad' },
      { limit: 101 },
      { limit: 0 },
      { status: 'unknown' },
      { source: 'cash' },
      { from: '2026-02-30' },
      { from: '2026-10-24', to: '2026-10-20' },
      { q: 'x'.repeat(101) },
    ])
      await list(dentist, query).expect(400);
    await detail(dentist, 'invalid').expect(400);
    const legacy = await payment(dentist, patient);
    await pool.query(
      "update transactions set method = 'pay_at_clinic' where id = $1",
      [legacy.id],
    );
    expect((await detail(dentist, legacy.id).expect(200)).body.source).toBe(
      'online',
    );
  });
});
