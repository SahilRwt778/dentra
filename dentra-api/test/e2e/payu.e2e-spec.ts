import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import {
  PayuGatewayService,
  payuPaymentHashString,
} from '../../src/modules/payments/payu-gateway.service';
import { PaymentGatewayService } from '../../src/modules/payments/payment-gateway.service';
import { RefundDeliveryService } from '../../src/modules/payments/refund-delivery.service';
import { ConfigService } from '@nestjs/config';

describe('PayU checkout, verified callbacks and provider ownership', () => {
  let app: INestApplication, pool: Pool, payu: PayuGatewayService;
  let token: (id: string, role?: string) => string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    payu = app.get(PayuGatewayService);
    token = (id, role = 'patient') =>
      app.get(JwtService).sign({ sub: id, role });
  });
  beforeEach(() =>
    jest.spyOn(payu, 'fetchOrderPayments').mockResolvedValue([]),
  );
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function fixture() {
    const patient = randomUUID(),
      dentist = randomUUID(),
      appointment = randomUUID(),
      transaction = randomUUID();
    const order = randomBytes(12).toString('hex');
    await pool.query(
      "insert into users(id,role,mobile) values($1,'patient',$3),($2,'dentist',$4)",
      [
        patient,
        dentist,
        `+91${randomInt(6000000000, 9999999999)}`,
        `+91${randomInt(6000000000, 9999999999)}`,
      ],
    );
    await pool.query(
      "insert into patients(user_id,full_name,date_of_birth,email) values($1,'PayU Test','1990-01-01','payu-test@example.com')",
      [patient],
    );
    await pool.query(
      "insert into dentists(user_id,full_name,qualification,specialization,council_reg_no,status) values($1,'PayU Dentist','BDS','General',$2,'verified')",
      [dentist, randomUUID()],
    );
    await pool.query(
      "insert into appointments(id,patient_id,dentist_id,type,scheduled_date,scheduled_time,concern_summary) values($1,$2,$3,'video','2099-01-01','10:00','Synthetic PayU test')",
      [appointment, patient, dentist],
    );
    await pool.query(
      "insert into transactions(id,appointment_id,idempotency_key,amount_paise,method,gateway_provider,gateway_ref,payment_expires_at) values($1,$2,$3,40050,'card','payu',$4,now()+interval '15 minutes')",
      [transaction, appointment, randomUUID(), order],
    );
    return { patient, dentist, appointment, transaction, order };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  const prepare = (f: Fixture, owner = f.patient, role = 'patient') =>
    request(app.getHttpServer())
      .post(`/payments/appointments/${f.appointment}/checkout`)
      .set('Authorization', `Bearer ${token(owner, role)}`);
  const hash = (f: Fixture, body: object, owner = f.patient) =>
    request(app.getHttpServer())
      .post(`/payments/appointments/${f.appointment}/hash`)
      .set('Authorization', `Bearer ${token(owner)}`)
      .send(body);
  function callbackBody(f: Fixture) {
    const body = {
      key: process.env.PAYU_MERCHANT_KEY!,
      txnid: f.order,
      amount: '400.50',
      status: 'success',
      productinfo: 'Dentra consultation',
      firstname: 'PayU',
      email: 'payu-test@example.com',
      udf1: f.patient,
      hash: '',
    };
    body.hash = createHash('sha512')
      .update(
        [
          process.env.PAYU_MERCHANT_SALT!,
          body.status,
          ...Array(9).fill(''),
          body.udf1,
          body.email,
          body.firstname,
          body.productinfo,
          body.amount,
          body.txnid,
          body.key,
        ].join('|'),
      )
      .digest('hex');
    return body;
  }
  const capture = (f: Fixture, amount = 40050) =>
    (payu.fetchOrderPayments as jest.Mock).mockResolvedValue([
      {
        id: 'payu' + f.order,
        order_id: f.order,
        amount,
        currency: 'INR',
        status: 'captured',
      },
    ]);

  test('prepares a consistent server snapshot; no salt or other patient data is exposed', async () => {
    const f = await fixture();
    const result = await prepare(f).expect(200);
    expect(result.body.provider).toBe('payu');
    expect(result.body.payUPaymentParams).toMatchObject({
      transactionId: f.order,
      amount: '400.50',
      email: 'payu-test@example.com',
      environment: '1',
    });
    expect(JSON.stringify(result.body)).not.toContain(
      process.env.PAYU_MERCHANT_SALT!,
    );
    expect((await prepare(f).expect(200)).body).toEqual(result.body);
    const source = payuPaymentHashString(result.body.payUPaymentParams);
    const signed = await hash(f, {
      hashName: 'payment',
      hashString: source,
    }).expect(200);
    expect(signed.body.hash).toBe(
      createHash('sha512')
        .update(source + process.env.PAYU_MERCHANT_SALT!)
        .digest('hex'),
    );
    await hash(f, {
      hashName: 'payment',
      hashString: source.replace('400.50', '0.01'),
    }).expect(400);
    await hash(f, {
      hashName: 'cancel_refund_transaction',
      hashString: 'arbitrary',
    }).expect(400);
  });
  test('enforces authentication, patient ownership, valid profile email and checkout expiry', async () => {
    const f = await fixture();
    await request(app.getHttpServer())
      .post(`/payments/appointments/${f.appointment}/checkout`)
      .expect(401);
    await prepare(f, randomUUID()).expect(404);
    await prepare(f, f.dentist, 'dentist').expect(403);
    await pool.query('update patients set email=null where user_id=$1', [
      f.patient,
    ]);
    expect((await prepare(f).expect(400)).body.message).toContain('email');
    await pool.query(
      "update patients set email='payu-test@example.com' where user_id=$1",
      [f.patient],
    );
    const result = await prepare(f).expect(200);
    await hash(
      f,
      {
        hashName: 'payment',
        hashString: payuPaymentHashString(result.body.payUPaymentParams),
      },
      randomUUID(),
    ).expect(404);
    await pool.query(
      "update transactions set payment_expires_at=now()-interval '1 second' where id=$1",
      [f.transaction],
    );
    await prepare(f).expect(409);
    await hash(f, {
      hashName: 'payment',
      hashString: payuPaymentHashString(result.body.payUPaymentParams),
    }).expect(409);
  });

  test('accepts Android SDK initialization and card lookup hashes without exposing a general signer', async () => {
    const f = await fixture();
    const prepared = await prepare(f).expect(200);
    const data = prepared.body.payUPaymentParams;
    const date = new Date().toUTCString();
    const requests = [
      {
        hashName: 'get_checkout_details',
        hashString: `${data.key}|get_checkout_details|${JSON.stringify({
          transactionDetails: { amount: data.amount },
          customerDetails: { mobile: data.phone },
        })}|`,
      },
      {
        hashName: 'get_sdk_configuration',
        hashString: `${data.key}|get_sdk_configuration|default|`,
      },
      {
        hashName: 'get_all_offer_details',
        hashString: `${JSON.stringify({ amount: 400.5 })}|${date}|`,
      },
      {
        hashName: 'quickPayEvent',
        hashString: `${JSON.stringify({
          amount: 400.5,
          phone: data.phone,
          userCredential: data.userCredential,
          requestId: f.order + Date.now(),
          requestType: 'quickpay',
          deviceId: 'synthetic-sdk-device',
        })}|${date}|`,
      },
    ];
    const results = await Promise.all(
      requests.map((body) => hash(f, body).expect(200)),
    );
    for (let index = 0; index < requests.length; index++)
      expect(results[index].body.hash).toBe(
        createHash('sha512')
          .update(requests[index].hashString + process.env.PAYU_MERCHANT_SALT!)
          .digest('hex'),
      );
    await hash(f, requests[3], randomUUID()).expect(404);
    await hash(f, {
      ...requests[3],
      hashString: requests[3].hashString.replace('400.5', '1.00'),
    }).expect(400);
    const card = {
      cardNumber: '5123456789012346',
      amount: data.amount,
      txnId: data.transactionId,
      merchantKey: data.key,
      isPricingCFEnable: false,
      source: 'ANDROID_SDK',
      isSITxn: false,
      disableConvFeeCompounding: false,
    };
    const cardRequest = {
      hashName: 'binBaseDetails',
      hashString: `${JSON.stringify(card)}|${date}|`,
    };
    const signedCard = await hash(f, cardRequest).expect(200);
    expect(signedCard.body.hash).toBe(
      createHash('sha512')
        .update(cardRequest.hashString + process.env.PAYU_MERCHANT_SALT!)
        .digest('hex'),
    );
    await hash(f, cardRequest, randomUUID()).expect(404);
    await hash(f, {
      ...cardRequest,
      hashString: `${JSON.stringify({ ...card, txnId: 'another-order' })}|${date}|`,
    }).expect(400);
    expect((await prepare(f).expect(200)).body).toEqual(prepared.body);
  });
  test('callbacks require a valid reverse hash and authenticated capture before marking paid', async () => {
    const f = await fixture();
    await request(app.getHttpServer())
      .post('/payments/payu/webhook')
      .type('form')
      .send({ ...callbackBody(f), hash: 'invalid' })
      .expect(400);
    expect(payu.fetchOrderPayments).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .post('/payments/payu/webhook')
      .type('form')
      .send(callbackBody(f))
      .expect(200);
    expect(
      (
        await pool.query('select status from transactions where id=$1', [
          f.transaction,
        ])
      ).rows[0].status,
    ).toBe('pending');
    capture(f, 1);
    await request(app.getHttpServer())
      .post('/payments/payu/webhook')
      .type('form')
      .send(callbackBody(f))
      .expect(400);
    capture(f);
    const callback = await request(app.getHttpServer())
      .post('/payments/payu/callback/success')
      .type('form')
      .send(callbackBody(f))
      .expect(200);
    expect(callback.headers['content-type']).toContain('text/html');
    const row = (
      await pool.query('select * from transactions where id=$1', [
        f.transaction,
      ])
    ).rows[0];
    expect(row.status).toBe('paid');
    expect(row.gateway_payment_ref).toBe('payu' + f.order);
    await prepare(f).expect(409);
    await request(app.getHttpServer())
      .post('/payments/payu/webhook')
      .type('form')
      .send(callbackBody(f))
      .expect(200);
  });
  test('a provider verification outage cannot start another checkout', async () => {
    const f = await fixture();
    (payu.fetchOrderPayments as jest.Mock).mockRejectedValueOnce(
      new Error('synthetic outage'),
    );
    const result = await prepare(f).expect(503);
    expect(result.body.message).toContain('before making another payment');
    const row = (
      await pool.query(
        'select gateway_checkout_data,status from transactions where id=$1',
        [f.transaction],
      )
    ).rows[0];
    expect(row.gateway_checkout_data).toBeNull();
    expect(row.status).toBe('pending');
  });

  test('a PayU event cannot confirm a legacy Razorpay payment with the same reference', async () => {
    const f = await fixture();
    await pool.query(
      "update transactions set gateway_provider='razorpay' where id=$1",
      [f.transaction],
    );
    capture(f);
    await request(app.getHttpServer())
      .post('/payments/payu/webhook')
      .type('form')
      .send(callbackBody(f))
      .expect(200);
    expect(payu.fetchOrderPayments).not.toHaveBeenCalled();
    expect(
      (
        await pool.query('select status from transactions where id=$1', [
          f.transaction,
        ])
      ).rows[0].status,
    ).toBe('pending');
  });
  test('dashboard refunds use verified provider state and cannot trust callback status or another payment', async () => {
    const f = await fixture();
    capture(f);
    await request(app.getHttpServer())
      .post('/payments/payu/webhook')
      .type('form')
      .send(callbackBody(f))
      .expect(200);
    const read = jest.spyOn(payu, 'fetchRefund').mockResolvedValue({
      refundId: '998877',
      paymentId: 'payu' + f.order,
      amountPaise: 40050,
      currency: 'INR',
      status: 'pending',
    });
    const callback = () =>
      request(app.getHttpServer())
        .post('/payments/payu/refund-webhook')
        .send({
          request_id: '998877',
          mihpayid: 'payu' + f.order,
          status: 'success',
          amt: '0.01',
        });
    await callback().expect(200);
    expect(
      (
        await pool.query('select status from transactions where id=$1', [
          f.transaction,
        ])
      ).rows[0].status,
    ).toBe('refund_pending');
    read.mockResolvedValueOnce({
      refundId: '998877',
      paymentId: 'unrelated-payment',
      amountPaise: 40050,
      currency: 'INR',
      status: 'processed',
    });
    await callback().expect(200);
    expect(
      (
        await pool.query('select status from transactions where id=$1', [
          f.transaction,
        ])
      ).rows[0].status,
    ).toBe('refund_pending');
    read.mockResolvedValueOnce({
      refundId: '998877',
      paymentId: 'payu' + f.order,
      amountPaise: 40050,
      currency: 'INR',
      status: 'processed',
    });
    await callback().expect(200);
    expect(
      (
        await pool.query('select status from transactions where id=$1', [
          f.transaction,
        ])
      ).rows[0].status,
    ).toBe('refunded');
  });

  test('a late capture after cancellation queues a refund using PayU, never reopens the slot', async () => {
    const f = await fixture();
    await pool.query("update appointments set status='cancelled' where id=$1", [
      f.appointment,
    ]);
    capture(f);
    await request(app.getHttpServer())
      .post('/payments/payu/webhook')
      .type('form')
      .send(callbackBody(f))
      .expect(200);
    const row = (
      await pool.query('select * from transactions where id=$1', [
        f.transaction,
      ])
    ).rows[0];
    expect(row.status).toBe('refund_pending');
    const saved = (
      await pool.query(
        'select * from payment_refunds where transaction_id=$1',
        [f.transaction],
      )
    ).rows[0];
    const refund = jest.spyOn(payu, 'refund').mockResolvedValue({
      refundId: '123456',
      paymentId: 'payu' + f.order,
      amountPaise: 40050,
      currency: 'INR',
      status: 'pending',
    });
    await pool.query(
      "update payment_refunds set next_attempt_at=now()+interval '1 day' where id<>$1",
      [saved.id],
    );
    await app.get(RefundDeliveryService).runOnce();
    expect(refund).toHaveBeenCalledWith('payu' + f.order, 40050, saved.id);
    expect(
      (
        await pool.query('select status from appointments where id=$1', [
          f.appointment,
        ])
      ).rows[0].status,
    ).toBe('cancelled');
  });
  test('new payment references select PayU without changing historical provider ownership', async () => {
    app.get(ConfigService).set('payments.provider', 'payu');
    const created = await app
      .get(PaymentGatewayService)
      .createOrder(100, 'synthetic');
    expect(created).toMatchObject({
      provider: 'payu',
      orderId: expect.stringMatching(/^[a-f\d]{24}$/),
    });
    app.get(ConfigService).set('payments.provider', 'razorpay');
  });
});
