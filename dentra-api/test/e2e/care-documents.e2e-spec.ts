import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { randomInt, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { CareDocumentsService } from '../../src/modules/care/documents/care-documents.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';

type Actor = { id: string; token: string };
type Page = {
  text: string;
  width: number;
  height: number;
  items: {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};
function inspect(bytes: Buffer): {
  pageCount: number;
  pages: Page[];
  text: string;
} {
  const result = spawnSync(
    process.execPath,
    [join(__dirname, '../../scripts/inspect-care-pdf.mjs'), '-'],
    { input: bytes, maxBuffer: 10 * 1024 * 1024 }
  );
  if (result.status !== 0) throw new Error(result.stderr.toString());
  const parsed = JSON.parse(
    result.stdout.toString().trim().split('\n').at(-1)!
  );
  return {
    ...parsed,
    text: parsed.pages.map((page: Page) => page.text).join('\n'),
  };
}

describe('Private prescription and visit-summary PDFs (e2e)', () => {
  let app: INestApplication, pool: Pool, jwt: JwtService;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
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
      'insert into users (id,role,mobile,email,password_hash) values ($1,$2,$3,$4,$5)',
      [
        id,
        role,
        role === 'admin' ? null : `+91${randomInt(6000000000, 9999999999)}`,
        role === 'admin' ? `pdf-${id}@example.test` : null,
        role === 'admin' ? 'fixture' : null,
      ]
    );
    if (role === 'patient')
      await pool.query(
        "insert into patients (user_id, full_name, date_of_birth, gender) values ($1,'Document Test Patient','1990-04-15','Male')",
        [id]
      );
    if (role === 'dentist')
      await pool.query(
        "insert into dentists (user_id, full_name, qualification, specialization, council_reg_no, status) values ($1,'Document Test Dentist','BDS','General Dentist',$2,'verified')",
        [id, `PDF-${id}`]
      );
    return { id, token: jwt.sign({ sub: id, role }) };
  }
  async function visit(
    state = 'in_consult',
    signed = false,
    withMedicines = true
  ) {
    const patient = await actor(),
      dentist = await actor('dentist'),
      id = randomUUID(),
      rx = randomUUID();
    const clinic = (
      await pool.query(
        "insert into dentist_clinics (dentist_id,name,address_line,phone) values ($1,'Document Test Clinic','Sample clinic address','+919000000000') returning id",
        [dentist.id]
      )
    ).rows[0].id;
    await pool.query(
      "insert into appointments (id,patient_id,dentist_id,clinic_id,type,scheduled_date,scheduled_time,status,concern_summary,completed_at) values ($1,$2,$3,$4,'clinic','2026-10-01','10:00',$5::appointment_status,'Test concern',case when $5::appointment_status = 'completed' then now() else null end)",
      [id, patient.id, dentist.id, clinic, state]
    );
    await pool.query(
      "insert into consultations (appointment_id,chief_complaint,findings,diagnosis,treatment_done,plan,follow_up_date) values ($1,'Test concern','Test findings','Test diagnosis','Test treatment','Test plan','2026-11-01')",
      [id]
    );
    await pool.query(
      'insert into prescriptions (id,appointment_id,signed_at,signed_by_dentist_id,signature_ref) values ($1,$2,$3,$4,$5)',
      [
        rx,
        id,
        signed ? new Date() : null,
        signed ? dentist.id : null,
        signed ? 'otp:private-confirmation-reference' : null,
      ]
    );
    if (withMedicines)
      await pool.query(
        "insert into prescription_items (prescription_id, medicine_name,strength,dose,frequency,duration,instructions) values ($1,'Test medicine','Test strength','Test dose','Test frequency','Test duration','Test instructions')",
        [rx]
      );
    return { patient, dentist, id, rx };
  }
  const pdf = (who: Actor, id: string, kind = 'prescription') =>
    request(app.getHttpServer())
      .get(`/appointments/${id}/${kind}/pdf`)
      .set('Authorization', `Bearer ${who.token}`);
  const post = (who: Actor, path: string, body = {}) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${who.token}`)
      .send(body);
  async function signingCode(value: Awaited<ReturnType<typeof visit>>) {
    const logs = jest.spyOn(console, 'log').mockImplementation();
    try {
      const response = await post(
        value.dentist,
        `/appointments/${value.id}/prescription/otp`
      ).expect(200);
      const code = /code=(\d{4})(?!\d)/.exec(
        logs.mock.calls
          .map((call) => String(call[0]))
          .find((line) => line.includes('(prescription)')) ?? ''
      )?.[1];
      expect(code).toBeTruthy();
      return { otpId: response.body.otpId, confirmationCode: code };
    } finally {
      logs.mockRestore();
    }
  }

  it('sets, preserves and clears a follow-up calendar date without changing other clinical sections', async () => {
    const value = await visit('in_consult', true);
    const save = () => request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`);
    const selected = await save().send({ followUpDate: '2028-02-29' }).expect(200);
    expect(selected.body.followUpDate).toBe('2028-02-29');
    expect(selected.body.prescription.signedAt).toBeTruthy();
    const preserved = await save().send({ plan: 'Updated advice' }).expect(200);
    expect(preserved.body.followUpDate).toBe('2028-02-29');
    const cleared = await save().send({ followUpDate: null }).expect(200);
    expect(cleared.body.followUpDate).toBeNull();
    expect(cleared.body.plan).toBe('Updated advice');
    expect(cleared.body.diagnosis).toBe('Test diagnosis');
    expect(cleared.body.prescription.signedAt).toBeTruthy();
    const reopened = await request(app.getHttpServer()).get(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`).expect(200);
    expect(reopened.body.followUpDate).toBeNull();
  });

  it('rejects invalid calendar dates atomically instead of normalizing them or accepting timestamps', async () => {
    const value = await visit();
    for (const followUpDate of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '2026-11-01T00:00:00Z', '', 123]) {
      await request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
        .set('Authorization', `Bearer ${value.dentist.token}`)
        .send({ followUpDate, plan: 'Must not save' }).expect(400);
    }
    const result = await request(app.getHttpServer()).get(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`).expect(200);
    expect(result.body.followUpDate).toBe('2026-11-01');
    expect(result.body.plan).toBe('Test plan');
  });

  it('includes the chosen follow-up date in the patient record after completion and forbids further edits', async () => {
    const value = await visit('in_consult', true);
    await request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`)
      .send({ followUpDate: '2026-12-04' }).expect(200);
    await post(value.dentist, `/appointments/${value.id}/consultation/complete`).expect(200);
    const record = await request(app.getHttpServer()).get(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.patient.token}`).expect(200);
    expect(record.body.followUpDate).toBe('2026-12-04');
    await request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`)
      .send({ followUpDate: null }).expect(409);
    const snapshot = await pool.query("select payload from care_documents where appointment_id = $1 and kind = 'visit-summary'", [value.id]);
    expect(snapshot.rows[0].payload.consultation.followUpDate).toBe('2026-12-04');
  });

  it('saves structured plan items independently of notes, follow-up and signed medicines', async () => {
    const value = await visit('in_consult', true);
    const items = [{ procedure: '  Test procedure  ', teeth: ['36', '37'], estimatedCostPaise: 12345 }];
    const save = () => request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`);
    const result = await save().send({ planItems: items }).expect(200);
    expect(result.body.planItems).toEqual([{ ...items[0], procedure: 'Test procedure' }]);
    expect(result.body.plan).toBe('Test plan');
    expect(result.body.followUpDate.slice(0, 10)).toBe('2026-11-01');
    expect(result.body.prescription.signedAt).toBeTruthy();
    const note = await save().send({ findings: 'Changed findings only' }).expect(200);
    expect(note.body.planItems).toEqual(result.body.planItems);
    const cleared = await save().send({ planItems: [] }).expect(200);
    expect(cleared.body.planItems).toEqual([]);
    expect(cleared.body.findings).toBe('Changed findings only');
    expect(cleared.body.plan).toBe('Test plan');
  });

  it('rejects invalid procedures, teeth and estimates before saving any plan changes', async () => {
    const value = await visit();
    const valid = { procedure: 'Test procedure', teeth: ['36'], estimatedCostPaise: 100 };
    const invalid = [null, [{ ...valid, procedure: '  ' }], [{ ...valid, procedure: 'x'.repeat(201) }],
      [{ ...valid, teeth: ['55'] }], [{ ...valid, teeth: ['36', '36'] }],
      [{ ...valid, estimatedCostPaise: -1 }], [{ ...valid, estimatedCostPaise: 1.5 }],
      [{ ...valid, estimatedCostPaise: 1000000001 }], Array.from({ length: 21 }, () => valid)];
    for (const planItems of invalid) await request(app.getHttpServer())
      .put(`/appointments/${value.id}/consultation`).set('Authorization', `Bearer ${value.dentist.token}`)
      .send({ plan: 'Must not save', planItems }).expect(400);
    const result = await request(app.getHttpServer()).get(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`).expect(200);
    expect(result.body.plan).toBe('Test plan');
    expect(result.body.planItems).toEqual([]);
  });

  it('restricts plan editing to the treating dentist and keeps completed plans read-only', async () => {
    const value = await visit('in_consult', false, false);
    const other = await actor('dentist');
    const body = { planItems: [{ procedure: 'Test procedure', teeth: [], estimatedCostPaise: null }] };
    for (const [who, status] of [[other, 404], [value.patient, 403]] as const)
      await request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
        .set('Authorization', `Bearer ${who.token}`).send(body).expect(status);
    await request(app.getHttpServer()).get(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.patient.token}`).expect(409);
    await request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`).send(body).expect(200);
    await post(value.dentist, `/appointments/${value.id}/consultation/complete`).expect(200);
    const visible = await request(app.getHttpServer()).get(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.patient.token}`).expect(200);
    expect(visible.body.planItems).toEqual(body.planItems);
    await request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`).send({ planItems: [] }).expect(409);
  });

  it('includes planned procedures and exact estimates in the immutable patient visit-summary PDF', async () => {
    const value = await visit('in_consult', false, false);
    const planItems = [
      { procedure: 'Test planned procedure', teeth: ['36', '37'], estimatedCostPaise: 12345 },
      { procedure: 'Test general procedure', teeth: [], estimatedCostPaise: null },
      { procedure: 'Test zero estimate', teeth: ['11'], estimatedCostPaise: 0 },
    ];
    await request(app.getHttpServer()).put(`/appointments/${value.id}/consultation`)
      .set('Authorization', `Bearer ${value.dentist.token}`).send({ planItems }).expect(200);
    await post(value.dentist, `/appointments/${value.id}/consultation/complete`).expect(200);
    await pool.query('update consultations set plan_items = $2::jsonb where appointment_id = $1', [value.id, '[]']);
    const response = await pdf(value.patient, value.id, 'visit-summary').expect(200);
    const document = inspect(response.body);
    for (const text of ['Test planned procedure', '36, 37', 'INR 123.45', 'Test general procedure', 'General treatment', 'INR 0.00'])
      expect(document.text).toContain(text);
  });

  it('exports real readable private PDFs containing the saved clinical data without signing secrets', async () => {
    const value = await visit('completed', true);
    for (const kind of ['prescription', 'visit-summary']) {
      const result = await pdf(value.patient, value.id, kind).expect(200);
      expect(result.headers['content-type']).toContain('application/pdf');
      expect(result.headers['cache-control']).toBe('private, no-store');
      expect(result.headers['content-disposition']).toContain(
        `dentra-${kind}-${value.id}.pdf`
      );
      expect(result.headers['x-content-type-options']).toBe('nosniff');
      expect(result.body.subarray(0, 5).toString()).toBe('%PDF-');
      const parsed = inspect(result.body);
      for (const text of [
        'Document Test Patient',
        'Document Test Dentist',
        'Document Test Clinic',
        'Test medicine',
        'Test strength',
        'Test dose',
        'Test frequency',
        'Test duration',
        'Test instructions',
        value.id,
        value.rx,
      ])
        expect(parsed.text).toContain(text);
      expect(parsed.text).not.toContain('private-confirmation-reference');
      expect(parsed.text).not.toContain('signature_ref');
      if (kind === 'visit-summary')
        for (const text of [
          'Test findings',
          'Test diagnosis',
          'Test treatment',
          'Test plan',
          '1 Nov 2026',
        ])
          expect(parsed.text).toContain(text);
      else expect(parsed.text).not.toContain('Test findings');
    }
  });
  it('requires the actual assigned participant and active accounts on both routes', async () => {
    const value = await visit('completed', true),
      otherPatient = await actor(),
      otherDentist = await actor('dentist'),
      admin = await actor('admin');
    for (const kind of ['prescription', 'visit-summary']) {
      await request(app.getHttpServer())
        .get(`/appointments/${value.id}/${kind}/pdf`)
        .expect(401);
      await pdf(otherPatient, value.id, kind).expect(404);
      await pdf(otherDentist, value.id, kind).expect(404);
      await pdf(admin, value.id, kind).expect(403);
      await pdf(value.dentist, 'not-a-uuid', kind).expect(400);
      await pdf(value.dentist, value.id, kind).expect(200);
    }
    await pool.query("update users set status = 'locked' where id = $1", [
      value.patient.id,
    ]);
    await pdf(value.patient, value.id).expect(404);
    await pool.query(
      "update dentists set status = 'rejected' where user_id = $1",
      [value.dentist.id]
    );
    await pdf(value.dentist, value.id).expect(403);
  });
  it('rejects unsigned/empty prescriptions and incomplete visits without creating snapshots', async () => {
    const unsigned = await visit('completed'),
      empty = await visit('completed', true, false),
      inProgress = await visit('in_consult', true),
      cancelled = await visit('cancelled', true);
    await pdf(unsigned.patient, unsigned.id).expect(409);
    await pdf(empty.patient, empty.id).expect(409);
    await pdf(inProgress.patient, inProgress.id).expect(409);
    await pdf(inProgress.dentist, inProgress.id, 'visit-summary').expect(409);
    await pdf(cancelled.dentist, cancelled.id).expect(409);
    expect(
      (
        await pool.query(
          'select * from care_documents where appointment_id = any($1::uuid[])',
          [[unsigned.id, empty.id, inProgress.id, cancelled.id]]
        )
      ).rowCount
    ).toBe(0);
  });
  it('captures signing/completion atomically, and later profile edits cannot rewrite documents', async () => {
    const value = await visit();
    await post(
      value.dentist,
      `/appointments/${value.id}/prescription/sign`,
      await signingCode(value)
    ).expect(200);
    const signed = (
      await pool.query(
        "select payload from care_documents where appointment_id = $1 and kind = 'prescription'",
        [value.id]
      )
    ).rows[0].payload;
    expect(signed.source).toBe('event');
    expect(signed.dentist.name).toBe('Document Test Dentist');
    await pdf(value.dentist, value.id).expect(200);
    await pdf(value.patient, value.id).expect(409);
    await post(
      value.dentist,
      `/appointments/${value.id}/consultation/complete`
    ).expect(200);
    expect(
      (
        await pool.query(
          'select kind from care_documents where appointment_id = $1',
          [value.id]
        )
      ).rows
    ).toHaveLength(2);
    await pool.query(
      "update dentists set full_name = 'Changed dentist name', council_reg_no = 'CHANGED' where user_id = $1",
      [value.dentist.id]
    );
    await pool.query(
      "update patients set full_name = 'Changed patient name' where user_id = $1",
      [value.patient.id]
    );
    for (const kind of ['prescription', 'visit-summary']) {
      const parsed = inspect(
        (await pdf(value.patient, value.id, kind).expect(200)).body
      );
      expect(parsed.text).toContain('Document Test Dentist');
      expect(parsed.text).toContain('Document Test Patient');
      expect(parsed.text).not.toContain('Changed');
    }
  });
  it('captures a historical record once even for concurrent first downloads', async () => {
    const value = await visit('completed', true);
    const results = await Promise.all([
      pdf(value.patient, value.id),
      pdf(value.dentist, value.id),
    ]);
    results.forEach((result) => expect(result.status).toBe(200));
    const rows = (
      await pool.query(
        'select payload from care_documents where appointment_id = $1',
        [value.id]
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.source).toBe('legacy-export');
    expect(inspect(results[0].body).text).toContain('Historical record');
  });
  it('rolls back the signed flag and signing snapshot when snapshot capture fails', async () => {
    const value = await visit(),
      code = await signingCode(value);
    jest
      .spyOn(app.get(CareDocumentsService), 'record')
      .mockRejectedValueOnce(new Error('Synthetic document failure'));
    await post(
      value.dentist,
      `/appointments/${value.id}/prescription/sign`,
      code
    ).expect(500);
    expect(
      (
        await pool.query('select signed_at from prescriptions where id = $1', [
          value.rx,
        ])
      ).rows[0].signed_at
    ).toBeNull();
    expect(
      (
        await pool.query(
          'select * from care_documents where appointment_id = $1',
          [value.id]
        )
      ).rowCount
    ).toBe(0);
    await post(
      value.dentist,
      `/appointments/${value.id}/prescription/sign`,
      code
    ).expect(200);
  });
  it('rolls back completion and its snapshot when a later notification write fails', async () => {
    const value = await visit('in_consult', true);
    jest
      .spyOn(app.get(NotificationsService), 'patientAppointmentEvent')
      .mockRejectedValueOnce(new Error('Synthetic notification failure'));
    await post(
      value.dentist,
      `/appointments/${value.id}/consultation/complete`
    ).expect(500);
    expect(
      (
        await pool.query('select status from appointments where id = $1', [
          value.id,
        ])
      ).rows[0].status
    ).toBe('in_consult');
    expect(
      (
        await pool.query(
          'select * from care_documents where appointment_id = $1',
          [value.id]
        )
      ).rowCount
    ).toBe(0);
  });
  it('paginates long notes and preserves the last line, headers and numbered footers', async () => {
    const value = await visit('completed', true);
    await pool.query(
      'update consultations set findings = $2 where appointment_id = $1',
      [
        value.id,
        'Long clinical findings for pagination. '.repeat(700) +
          'FINAL FINDINGS MARKER',
      ]
    );
    const parsed = inspect(
      (await pdf(value.patient, value.id, 'visit-summary').expect(200)).body
    );
    expect(parsed.pageCount).toBeGreaterThan(2);
    expect(parsed.text).toContain('FINAL FINDINGS MARKER');
    expect(parsed.text).toContain('Test instructions');
    parsed.pages.forEach((page, index) => {
      expect(page.text).toContain(`Page ${index + 1} of ${parsed.pageCount}`);
      expect(page.text).toContain('Visit summary');
      for (const item of page.items.filter((item) => item.text.trim())) {
        expect(item.x).toBeGreaterThanOrEqual(45);
        expect(item.x + item.width).toBeLessThanOrEqual(page.width - 40);
        expect(item.y).toBeGreaterThan(27);
        expect(item.y).toBeLessThan(page.height - 20);
      }
    });
  });
  it('embeds fonts for Indian-language names and rejects unsupported glyphs without corrupting the record', async () => {
    const value = await visit('completed', true);
    await pool.query(
      "update patients set full_name = 'आरव शर्मा / ਅਮਨ ਸਿੰਘ / அருண் / অনন্যা' where user_id = $1",
      [value.patient.id]
    );
    const result = await pdf(value.patient, value.id).expect(200);
    expect(result.body.length).toBeGreaterThan(10000);
    expect(inspect(result.body).text).not.toContain('�');
    const unsupported = await visit('completed', true);
    await pool.query(
      "update prescription_items set instructions = 'Unsupported glyph: 🦷' where prescription_id = $1",
      [unsupported.rx]
    );
    await pdf(unsupported.patient, unsupported.id).expect(422);
    expect(
      (
        await pool.query(
          'select instructions from prescription_items where prescription_id = $1',
          [unsupported.rx]
        )
      ).rows[0].instructions
    ).toContain('🦷');
  });
});
