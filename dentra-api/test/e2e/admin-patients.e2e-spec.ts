import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { ProfilePhotosService } from '../../src/modules/identity/profile-photos/profile-photos.service';

describe('Admin patient directory (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let adminToken: string;
  let patientToken: string;
  let dentistToken: string;
  let patients: { id: string; mobile: string }[];
  let dentistId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const jwt = module.get(JwtService);
    const { rows: admin } = await pool.query(
      "insert into users(role,email,password_hash) values ('admin','patient-directory-admin@dentra.test','synthetic') returning id",
    );
    adminToken = jwt.sign({ sub: admin[0].id, role: 'admin' });
    const { rows: people } = await pool.query(
      `with accounts as (
        insert into users(role,mobile,status)
        select 'patient', '+91986' || lpad(i::text,7,'0'), case when i=4 then 'locked' when i=5 then 'deleted' else 'active' end
        from generate_series(1,22) i returning id,mobile
      ), profiles as (
        insert into patients(user_id,full_name,date_of_birth,email,city,created_at)
        select id, case when right(mobile,2)='22' then 'Farah AdminPatientSearchOnly'
          when right(mobile,2)='21' then 'Percent %_ Name' else 'Directory Patient ' || right(mobile,2) end,
          '1990-05-12', 'directory-' || right(mobile,2) || '@dentra.test', 'Delhi',
          now() - right(mobile,2)::int * interval '1 day'
        from accounts returning user_id
      ) select a.id,a.mobile from accounts a join profiles p on p.user_id=a.id order by a.mobile`,
    );
    patients = people;
    patientToken = jwt.sign({ sub: patients[0].id, role: 'patient' });
    const { rows: dentists } = await pool.query(
      `with u as (insert into users(role,mobile) values ('dentist','+919870000001') returning id)
       insert into dentists(user_id,full_name,qualification,specialization,council_reg_no,status)
       select id,'Not A Patient','BDS','General','DIRECTORY-TEST','verified' from u returning user_id`,
    );
    dentistId = dentists[0].user_id;
    dentistToken = jwt.sign({ sub: dentistId, role: 'dentist' });
    // A phone-only login is not a registered patient and must not appear in the directory.
    await pool.query(
      "insert into users(role,mobile) values ('patient','+919860000099')",
    );
    await pool.query(
      `insert into appointments(patient_id,dentist_id,type,scheduled_date,scheduled_time,concern_summary,status)
       select $1,$2,'video','2001-01-01'::date+i,'10:00','Directory history',
       (case when i%2=0 then 'completed' else 'booked' end)::appointment_status
       from generate_series(0,25) i`,
      [patients[21].id, dentistId],
    );
    await pool.query(
      `insert into appointments(patient_id,dentist_id,type,scheduled_date,scheduled_time,concern_summary,status)
       values ($1,$2,'video','2010-01-01','10:00','Different patient','completed')`,
      [patients[0].id, dentistId],
    );
    const reference = await module
      .get(ProfilePhotosService)
      .save('patient', patients[21].id, {
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fQAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    await pool.query(
      'update patients set profile_photo_url=$1 where user_id=$2',
      [reference, patients[21].id],
    );
  }, 120000);
  afterAll(async () => {
    await pool?.end();
    await app?.close();
  });

  const get = (path: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  it('paginates registered patients and searches and filters the full directory before paging', async () => {
    const first = await get('/admin/patients').expect(200);
    expect(first.body).toMatchObject({
      total: 22,
      page: 1,
      limit: 20,
      nextPage: 2,
    });
    expect(first.body.items).toHaveLength(20);
    expect(first.body.items[0]).toMatchObject({
      id: patients[0].id,
      mobile: patients[0].mobile,
      dateOfBirth: '1990-05-12',
      appointmentCount: 1,
      completedCount: 1,
      lastVisitDate: '2010-01-01',
    });
    const second = await get('/admin/patients?page=2').expect(200);
    expect(second.body.items.map((p: { id: string }) => p.id)).toEqual([
      patients[20].id,
      patients[21].id,
    ]);
    expect(second.body.nextPage).toBeNull();
    const search = await get('/admin/patients?search=farah').expect(200);
    expect(search.body.total).toBe(1);
    expect(search.body.items[0]).toMatchObject({
      id: patients[21].id,
      appointmentCount: 26,
      completedCount: 13,
      lastVisitDate: '2001-01-25',
    });
    expect(search.body.items[0].profilePhotoUrl).toMatch(
      /^\/profile-photos\/patient\//,
    );
    await request(app.getHttpServer())
      .get(search.body.items[0].profilePhotoUrl)
      .expect('Content-Type', /image\/png/)
      .expect(200);
    expect(
      (
        await get('/admin/patients?search=DIRECTORY-02%40DENTRA.TEST').expect(
          200,
        )
      ).body.items[0].id,
    ).toBe(patients[1].id);
    expect(
      (await get('/admin/patients?search=9860000001').expect(200)).body.items[0]
        .id,
    ).toBe(patients[0].id);
    expect(
      (await get('/admin/patients?search=%25_').expect(200)).body.total,
    ).toBe(1);
    expect(
      (await get('/admin/patients?status=active&limit=10').expect(200)).body,
    ).toMatchObject({ total: 20, limit: 10, nextPage: 2 });
    expect(
      (await get('/admin/patients?status=locked').expect(200)).body.items.map(
        (p: { id: string }) => p.id,
      ),
    ).toEqual([patients[3].id]);
    expect(
      (await get('/admin/patients?page=99').expect(200)).body,
    ).toMatchObject({ items: [], total: 22, nextPage: null });
    expect(
      (await get('/admin/patients?search=Not%20A%20Patient').expect(200)).body
        .total,
    ).toBe(0);
  }, 120000);

  it('returns profile details and only the selected patient appointment history', async () => {
    const profile = await get(`/admin/patients/${patients[21].id}`).expect(200);
    expect(profile.body).toMatchObject({
      fullName: 'Farah AdminPatientSearchOnly',
      dateOfBirth: '1990-05-12',
      preferredLanguage: 'English',
      guardian: null,
    });
    expect(profile.body).not.toHaveProperty('passwordHash');
    expect(profile.body).not.toHaveProperty('allergies');
    const first = await get(
      `/admin/appointments?patientId=${patients[21].id}`,
    ).expect(200);
    expect(first.body).toMatchObject({
      total: 26,
      page: 1,
      limit: 20,
      nextPage: 2,
      summary: { completed: 13 },
    });
    expect(first.body.items[0].date).toBe('2001-01-26');
    expect(
      first.body.items.every(
        (item: { patientName: string }) =>
          item.patientName === profile.body.fullName,
      ),
    ).toBe(true);
    const second = await get(
      `/admin/appointments?patientId=${patients[21].id}&page=2`,
    ).expect(200);
    expect(second.body.items).toHaveLength(6);
    expect(second.body.nextPage).toBeNull();
    await get(`/admin/patients/${dentistId}`).expect(404);
    await get('/admin/patients/00000000-0000-4000-8000-000000000000').expect(
      404,
    );
  }, 120000);

  it('requires the admin role and validates search, page sizes, statuses and patient IDs', async () => {
    for (const path of [
      '/admin/patients',
      `/admin/patients/${patients[0].id}`,
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await get(path, patientToken).expect(403);
      await get(path, dentistToken).expect(403);
    }
    for (const query of [
      'page=0',
      'page=abc',
      'page=1.5',
      'limit=0',
      'limit=101',
      'status=invalid',
      `search=${'a'.repeat(101)}`,
    ])
      await get(`/admin/patients?${query}`).expect(400);
    await get('/admin/patients/not-a-uuid').expect(400);
    await get('/admin/appointments?patientId=not-a-uuid').expect(400);
  }, 120000);
});
