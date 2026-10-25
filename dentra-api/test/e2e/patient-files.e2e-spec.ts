import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { randomInt, randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { PatientFilesCleanupService } from '../../src/modules/care/files/patient-files-cleanup.service';
import { RazorpayGatewayService } from '../../src/modules/payments/razorpay-gateway.service';

const photo = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=',
  'base64'
);
const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
);
type Actor = { id: string; token: string };

describe('Private patient files (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService;
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
      })
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
    role: 'patient' | 'dentist' | 'admin' = 'patient'
  ): Promise<Actor> {
    const id = randomUUID();
    await pool.query(
      `insert into users (id, role, mobile, email, password_hash) values ($1,$2,$3,$4,$5)`,
      [
        id,
        role,
        role === 'admin' ? null : `+91${randomInt(6000000000, 9999999999)}`,
        role === 'admin' ? `files-${id}@example.test` : null,
        role === 'admin' ? 'test-fixture' : null,
      ]
    );
    if (role === 'patient')
      await pool.query(
        "insert into patients (user_id,full_name,date_of_birth) values ($1,'File Test Patient','1990-01-01')",
        [id]
      );
    if (role === 'dentist')
      await pool.query(
        `insert into dentists (user_id,full_name,qualification,specialization,council_reg_no,status,offers_video,video_hours_from,video_hours_to,fee_video_paise)
       values ($1,'File Test Dentist','BDS','General',$2,'verified',true,'09:00','18:00',1000)`,
        [id, `FILES-${id}`]
      );
    return { id, token: jwt.sign({ sub: id, role }) };
  }
  const auth = (value: Actor) => `Bearer ${value.token}`;
  const upload = (
    owner: Actor,
    key: string = randomUUID(),
    bytes = photo,
    name = 'Tooth.png',
    type = 'image/png'
  ) =>
    request(app.getHttpServer())
      .post('/patients/me/files')
      .set('Authorization', auth(owner))
      .field('uploadKey', key)
      .attach('file', bytes, { filename: name, contentType: type });
  const content = (owner: Actor, id: string) =>
    request(app.getHttpServer())
      .get(`/patient-files/${id}/content`)
      .set('Authorization', auth(owner));
  const list = (owner: Actor, suffix = '') =>
    request(app.getHttpServer())
      .get(`/patients/me/files${suffix}`)
      .set('Authorization', auth(owner));
  const remove = (owner: Actor, id: string) =>
    request(app.getHttpServer())
      .delete(`/patients/me/files/${id}`)
      .set('Authorization', auth(owner));
  const attachments = (owner: Actor, id: string) =>
    request(app.getHttpServer())
      .get(`/appointments/${id}/attachments`)
      .set('Authorization', auth(owner));
  function booking(dentist: Actor, ids: string[]) {
    return {
      dentistId: dentist.id,
      type: 'video',
      date: '2099-01-11',
      time: '10:00',
      concern: 'Test concern',
      paymentMethod: 'upi',
      idempotencyKey: randomUUID(),
      attachmentIds: ids,
    };
  }
  const book = (patient: Actor, body: object) =>
    request(app.getHttpServer())
      .post('/appointments')
      .set('Authorization', auth(patient))
      .send(body);

  it('uploads exact private bytes, detects MIME from content, and stores no public path in metadata', async () => {
    const owner = await actor();
    const response = await upload(
      owner,
      undefined,
      photo,
      'tooth.jpg',
      'application/octet-stream'
    ).expect(201);
    expect(response.body).toMatchObject({
      name: 'tooth.jpg',
      mimeType: 'image/png',
      sizeBytes: photo.length,
      appointmentId: null,
    });
    expect(response.body.expiresAt).toBeTruthy();
    expect(response.body).not.toHaveProperty('patientId');
    expect(response.body).not.toHaveProperty('contentHash');
    expect(response.body).not.toHaveProperty('url');
    const fetched = await content(owner, response.body.id).expect(200);
    expect(fetched.body).toEqual(photo);
    expect(fetched.headers['content-type']).toContain('image/png');
    expect(fetched.headers['cache-control']).toBe('private, no-store');
    expect(fetched.headers['x-content-type-options']).toBe('nosniff');
    expect(fetched.headers['content-security-policy']).toContain('sandbox');
    expect(fetched.headers['content-disposition']).toContain('attachment;');
    expect(fetched.headers['content-disposition']).toContain('tooth.jpg.png');
    const path = join(process.env.PATIENT_FILES_DIRECTORY!, response.body.id);
    expect(await readFile(path)).toEqual(photo);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(
      (await list(owner).expect(200)).body.items.map(
        (file: { id: string }) => file.id
      )
    ).toEqual([response.body.id]);
  });
  it('requires authentication and patient role to upload, and validates file/key/query inputs', async () => {
    const owner = await actor(),
      dentist = await actor('dentist'),
      admin = await actor('admin');
    await request(app.getHttpServer()).post('/patients/me/files').expect(401);
    for (const value of [dentist, admin]) {
      await upload(value).expect(403);
      await list(value).expect(403);
    }
    await upload(owner, 'invalid-key').expect(400);
    await request(app.getHttpServer())
      .post('/patients/me/files')
      .set('Authorization', auth(owner))
      .field('uploadKey', randomUUID())
      .expect(400);
    await list(owner, '?page=0').expect(400);
    await list(owner, '?appointmentId=bad').expect(400);
    await content(owner, 'bad-id').expect(400);
  });
  it('rejects empty, disguised unsupported, oversized and extra multipart files', async () => {
    const owner = await actor();
    await upload(owner, undefined, Buffer.alloc(0)).expect(400);
    await upload(
      owner,
      undefined,
      Buffer.from('<html>not a photo</html>')
    ).expect(400);
    await upload(
      owner,
      undefined,
      Buffer.alloc(10 * 1024 * 1024 + 1, 255)
    ).expect(413);
    await request(app.getHttpServer())
      .post('/patients/me/files')
      .set('Authorization', auth(owner))
      .field('uploadKey', randomUUID())
      .attach('file', photo, 'one.png')
      .attach('file', photo, 'two.png')
      .expect(400);
    expect((await list(owner)).body.items).toEqual([]);
  });
  it('accepts PDF reports and sanitizes filenames', async () => {
    const owner = await actor();
    const response = await upload(
      owner,
      undefined,
      pdf,
      'report.pdf',
      'application/pdf'
    ).expect(201);
    expect(response.body.mimeType).toBe('application/pdf');
    const fetched = await content(owner, response.body.id).expect(200);
    expect(fetched.headers['content-type']).toContain('application/pdf');
    expect(fetched.body).toEqual(pdf);
    const safe = await upload(
      owner,
      undefined,
      photo,
      'folder\\tooth.png'
    ).expect(201);
    expect(safe.body.name).not.toContain('\\');
  });
  it('isolates drafts from other patients, dentists and admins', async () => {
    const owner = await actor(),
      other = await actor(),
      dentist = await actor('dentist'),
      admin = await actor('admin');
    const file = (await upload(owner).expect(201)).body;
    await content(other, file.id).expect(404);
    await remove(other, file.id).expect(404);
    await content(dentist, file.id).expect(404);
    await content(admin, file.id).expect(403);
    expect((await list(other)).body.items).toEqual([]);
    await request(app.getHttpServer())
      .get(`/patient-files/${file.id}/content`)
      .expect(401);
  });
  it('reuses an upload key on retries and rejects changed content, including concurrent uploads', async () => {
    const owner = await actor(),
      key = randomUUID();
    const [first, second] = await Promise.all([
      upload(owner, key),
      upload(owner, key),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).toBe(second.body.id);
    await upload(owner, key, pdf).expect(409);
    expect((await list(owner)).body.items).toHaveLength(1);
  });
  it('shares files with the assigned dentist atomically and keeps booking retries idempotent', async () => {
    const owner = await actor(),
      dentist = await actor('dentist'),
      other = await actor('dentist');
    const file = (await upload(owner).expect(201)).body;
    const body = booking(dentist, [file.id]);
    const appointment = (await book(owner, body).expect(201)).body;
    expect((await book(owner, body).expect(201)).body.id).toBe(appointment.id);
    expect(
      (await attachments(dentist, appointment.id).expect(200)).body
    ).toMatchObject([
      { id: file.id, appointmentId: appointment.id, expiresAt: null },
    ]);
    await content(dentist, file.id).expect(200);
    await content(owner, file.id).expect(200);
    await content(other, file.id).expect(404);
    await attachments(other, appointment.id).expect(404);
    await attachments(await actor(), appointment.id).expect(404);
    await remove(owner, file.id).expect(409);
    const next = { ...body, time: '10:30', idempotencyKey: randomUUID() };
    await book(owner, next).expect(409);
    await pool.query(
      "update patient_files set expires_at = now() - interval '2 days' where id = $1",
      [file.id]
    );
    await app.get(PatientFilesCleanupService).runOnce();
    await content(dentist, file.id).expect(200);
    const listed = (await list(owner, `?appointmentId=${appointment.id}`)).body
      .items[0];
    expect(listed).toMatchObject({
      id: file.id,
      dentistName: 'File Test Dentist',
      expiresAt: null,
    });
  });
  it('rolls back file bindings and the appointment when payment order creation fails', async () => {
    const owner = await actor(),
      dentist = await actor('dentist');
    const file = (await upload(owner).expect(201)).body;
    jest
      .spyOn(app.get(RazorpayGatewayService), 'createOrder')
      .mockRejectedValueOnce(new Error('Synthetic payment outage'));
    const body = booking(dentist, [file.id]);
    await book(owner, body).expect(500);
    expect(
      (
        await pool.query(
          'select appointment_id from patient_files where id = $1',
          [file.id]
        )
      ).rows[0].appointment_id
    ).toBeNull();
    expect(
      (
        await pool.query('select id from appointments where patient_id = $1', [
          owner.id,
        ])
      ).rowCount
    ).toBe(0);
    await content(dentist, file.id).expect(404);
    await book(owner, body).expect(201);
  });
  it('rejects foreign, missing, expired, removed, duplicate and too many attachments without creating a booking', async () => {
    const owner = await actor(),
      other = await actor(),
      dentist = await actor('dentist');
    const file = (await upload(other).expect(201)).body;
    await book(owner, booking(dentist, [file.id])).expect(409);
    await book(owner, booking(dentist, [randomUUID()])).expect(409);
    const expired = (await upload(owner).expect(201)).body;
    await pool.query(
      "update patient_files set expires_at = now() - interval '1 second' where id = $1",
      [expired.id]
    );
    await book(owner, booking(dentist, [expired.id])).expect(409);
    const removed = (await upload(owner).expect(201)).body;
    await remove(owner, removed.id).expect(204);
    await book(owner, booking(dentist, [removed.id])).expect(409);
    await book(owner, booking(dentist, [file.id, file.id])).expect(400);
    await book(
      owner,
      booking(
        dentist,
        Array.from({ length: 9 }, () => randomUUID())
      )
    ).expect(400);
    expect(
      (
        await pool.query('select id from appointments where patient_id = $1', [
          owner.id,
        ])
      ).rowCount
    ).toBe(0);
  });
  it('expires unused files immediately, purges their bytes, and preserves uploaded-key tombstones', async () => {
    const owner = await actor(),
      key = randomUUID();
    const file = (await upload(owner, key).expect(201)).body;
    await pool.query(
      "update patient_files set expires_at = now() - interval '1 second' where id = $1",
      [file.id]
    );
    await content(owner, file.id).expect(404);
    expect((await list(owner)).body.items).toEqual([]);
    await upload(owner, key).expect(409);
    await app.get(PatientFilesCleanupService).runOnce();
    await expect(
      stat(join(process.env.PATIENT_FILES_DIRECTORY!, file.id))
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(
      (
        await pool.query('select purged_at from patient_files where id = $1', [
          file.id,
        ])
      ).rows[0].purged_at
    ).toBeTruthy();
    await upload(owner, key).expect(409);
  });
  it('removes a draft idempotently and denies its content before physical cleanup', async () => {
    const owner = await actor(),
      key = randomUUID();
    const file = (await upload(owner, key).expect(201)).body;
    await remove(owner, file.id).expect(204);
    await remove(owner, file.id).expect(204);
    await content(owner, file.id).expect(404);
    await upload(owner, key).expect(409);
    await app.get(PatientFilesCleanupService).runOnce();
    await expect(
      stat(join(process.env.PATIENT_FILES_DIRECTORY!, file.id))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('limits unused uploads per patient and frees quota when one is removed', async () => {
    const owner = await actor();
    let id = '';
    for (let n = 0; n < 20; n++) id = (await upload(owner).expect(201)).body.id;
    await upload(owner).expect(409);
    await remove(owner, id).expect(204);
    await upload(owner).expect(201);
  });
  it('denies locked accounts and dentists whose verification was revoked', async () => {
    const owner = await actor(),
      dentist = await actor('dentist');
    const file = (await upload(owner).expect(201)).body;
    const appointment = (
      await book(owner, booking(dentist, [file.id])).expect(201)
    ).body;
    await pool.query("update users set status = 'locked' where id = $1", [
      owner.id,
    ]);
    await content(owner, file.id).expect(404);
    await attachments(owner, appointment.id).expect(404);
    await upload(owner).expect(404);
    await pool.query(
      "update dentists set status = 'rejected' where user_id = $1",
      [dentist.id]
    );
    await content(dentist, file.id).expect(403);
    await attachments(dentist, appointment.id).expect(403);
  });
});
