import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6fQAAAAASUVORK5CYII=',
  'base64',
);
const patientDetails = {
  fullName: 'Photo Patient',
  dateOfBirth: '1995-01-01',
  termsConsent: true,
  telemedicineConsent: true,
};
const dentistDetails = {
  fullName: 'Photo Dentist',
  qualification: 'BDS',
  specialization: 'General Dentist',
  councilRegNo: 'PHOTO-TEST',
  primaryClinicName: 'Photo Clinic',
  termsConsent: true,
  telemedicineConsent: true,
};

describe('Registration profile photos (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let jwt: JwtService;
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
    jwt = module.get(JwtService);
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });
  afterAll(async () => {
    await pool.end();
    await app.close();
  });

  async function account(role: 'patient' | 'dentist' = 'patient') {
    const mobile = `+9197${Math.floor(10000000 + Math.random() * 89999999)}`;
    const { rows } = await pool.query(
      'insert into users (role, mobile) values ($1, $2) returning id',
      [role, mobile],
    );
    return {
      id: rows[0].id as string,
      token: jwt.sign({ sub: rows[0].id, role }),
    };
  }
  const register = (token: string, bytes = png, details = patientDetails) =>
    request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${token}`)
      .field('details', JSON.stringify(details))
      .attach('profilePhoto', bytes, 'profile.png');

  it('saves the selected patient photo and exposes only an image-specific expiring link', async () => {
    const owner = await account();
    await register('').expect(401);
    const response = await register(owner.token).expect(201);
    expect(response.body.profilePhotoUrl).toMatch(
      /^\/profile-photos\/patient\//,
    );
    expect(response.body.profilePhotoUrl).not.toContain(
      'profile-photos/patient/' + owner.id + '/',
    );
    await request(app.getHttpServer())
      .get(response.body.profilePhotoUrl)
      .expect('Content-Type', /image\/png/)
      .expect('Cache-Control', 'private, no-store')
      .expect(200);
    const me = await request(app.getHttpServer())
      .get('/patients/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(me.body.profilePhotoUrl).toBeTruthy();
    await register(owner.token).expect(409);
    await request(app.getHttpServer())
      .get(response.body.profilePhotoUrl.replace(/signature=./, 'signature=z'))
      .expect(404);
    await request(app.getHttpServer())
      .get(response.body.profilePhotoUrl.replace(/expires=\d+/, 'expires=1'))
      .expect(404);
    const other = await account();
    await request(app.getHttpServer())
      .get(response.body.profilePhotoUrl.replace(owner.id, other.id))
      .expect(404);
    await request(app.getHttpServer())
      .get(response.body.profilePhotoUrl.replace('/patient/', '/dentist/'))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/profile-photos/patient/${owner.id}`)
      .expect(404);
  });

  it('keeps registration without a photo compatible with existing clients', async () => {
    const owner = await account();
    const result = await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(patientDetails)
      .expect(201);
    expect(result.body.profilePhotoUrl).toBeNull();
  });

  it('lets a registered patient add, replace and remove their own photo without losing profile details', async () => {
    const owner = await account();
    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(patientDetails)
      .expect(201);
    const first = await request(app.getHttpServer())
      .patch('/patients/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', JSON.stringify({ city: 'Updated City' }))
      .attach('profilePhoto', png, 'profile.png')
      .expect(200);
    expect(first.body.city).toBe('Updated City');
    expect(first.body.fullName).toBe(patientDetails.fullName);
    await request(app.getHttpServer())
      .get(first.body.profilePhotoUrl)
      .expect(200);

    const second = await request(app.getHttpServer())
      .patch('/patients/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', '{}')
      .attach('profilePhoto', png, 'replacement.png')
      .expect(200);
    await request(app.getHttpServer())
      .get(first.body.profilePhotoUrl)
      .expect(404);
    await request(app.getHttpServer())
      .get(second.body.profilePhotoUrl)
      .expect(200);

    const ordinary = await request(app.getHttpServer())
      .patch('/patients/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ allergies: 'None' })
      .expect(200);
    await request(app.getHttpServer())
      .get(ordinary.body.profilePhotoUrl)
      .expect(200);
    const removed = await request(app.getHttpServer())
      .patch('/patients/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ removeProfilePhoto: true })
      .expect(200);
    expect(removed.body.profilePhotoUrl).toBeNull();
    expect(removed.body.allergies).toBe('None');
    expect(removed.body.city).toBe('Updated City');
    await request(app.getHttpServer())
      .get(second.body.profilePhotoUrl)
      .expect(404);
  });

  it('preserves the patient photo and details on invalid uploads and enforces account ownership', async () => {
    const owner = await account();
    const created = await register(owner.token).expect(201);
    const patch = () =>
      request(app.getHttpServer())
        .patch('/patients/me')
        .set('Authorization', `Bearer ${owner.token}`);
    await patch()
      .field('details', JSON.stringify({ fullName: 'Should not save' }))
      .attach(
        'profilePhoto',
        Buffer.from('%PDF-1.4\nnot an avatar'),
        'report.pdf',
      )
      .expect(400);
    await patch()
      .field('details', '{}')
      .attach('profilePhoto', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')
      .expect(413);
    await patch()
      .field('details', '{bad json')
      .attach('profilePhoto', png, 'profile.png')
      .expect(400);
    await patch()
      .field('details', JSON.stringify({ removeProfilePhoto: true }))
      .attach('profilePhoto', png, 'profile.png')
      .expect(400);
    const unchanged = await request(app.getHttpServer())
      .get('/patients/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(unchanged.body.fullName).toBe(patientDetails.fullName);
    await request(app.getHttpServer())
      .get(created.body.profilePhotoUrl)
      .expect(200);

    const other = await account();
    await register(other.token).expect(201);
    await request(app.getHttpServer())
      .patch('/patients/me')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ removeProfilePhoto: true, userId: owner.id })
      .expect(200);
    await request(app.getHttpServer())
      .get(created.body.profilePhotoUrl)
      .expect(200);
    const dentist = await account('dentist');
    await request(app.getHttpServer())
      .patch('/patients/me')
      .set('Authorization', `Bearer ${dentist.token}`)
      .send({ removeProfilePhoto: true })
      .expect(403);
  });

  it('rejects invalid images, oversized files and malformed details before creating a profile', async () => {
    const owner = await account();
    await register(owner.token, Buffer.from('<svg>not a photo</svg>')).expect(
      400,
    );
    await register(
      owner.token,
      Buffer.from('%PDF-1.4\nnot a profile photo'),
    ).expect(400);
    await register(owner.token, Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
    await register(owner.token, png, {
      ...patientDetails,
      termsConsent: false,
    }).expect(400);
    await request(app.getHttpServer())
      .post('/patients/register')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', '{bad json')
      .attach('profilePhoto', png, 'profile.png')
      .expect(400);
    const { rows } = await pool.query(
      'select count(*)::int as count from patients where user_id = $1',
      [owner.id],
    );
    expect(rows[0].count).toBe(0);
    await register(owner.token).expect(201);
  });

  it('replaces a draft dentist photo, invalidates the old link and preserves it on ordinary draft saves', async () => {
    const owner = await account('dentist');
    await register(owner.token).expect(403);
    const created = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', JSON.stringify(dentistDetails))
      .attach('profilePhoto', png, 'profile.png')
      .expect(201);
    const firstUrl = created.body.profilePhotoUrl;
    expect(firstUrl).toMatch(/^\/profile-photos\/dentist\//);
    await request(app.getHttpServer()).get(firstUrl).expect(200);
    const updated = await request(app.getHttpServer())
      .patch('/dentists/applications/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', JSON.stringify(dentistDetails))
      .attach('profilePhoto', png, 'new-profile.png')
      .expect(200);
    await request(app.getHttpServer()).get(firstUrl).expect(404);
    await request(app.getHttpServer())
      .get(updated.body.profilePhotoUrl)
      .expect(200);
    const ordinary = await request(app.getHttpServer())
      .patch('/dentists/applications/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(dentistDetails)
      .expect(200);
    await request(app.getHttpServer())
      .get(ordinary.body.profilePhotoUrl)
      .expect(200);
    // Profile photos never count as the required KYC selfie or grant clinical access.
    expect(ordinary.body.documents).toEqual([]);
    await request(app.getHttpServer())
      .post('/dentists/applications/me/submit')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(422);
    await request(app.getHttpServer())
      .get('/appointments')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
    await request(app.getHttpServer()).get(`/dentists/${owner.id}`).expect(404);
  });

  it('lets a verified dentist replace and remove their own photo while saving profile details', async () => {
    const owner = await account('dentist');
    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${owner.token}`)
      .send(dentistDetails)
      .expect(201);
    await pool.query(
      "update dentists set status = 'verified' where user_id = $1",
      [owner.id],
    );
    const first = await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', JSON.stringify({ qualification: 'MDS' }))
      .attach('profilePhoto', png, 'profile.png')
      .expect(200);
    expect(first.body.qualification).toBe('MDS');
    expect(first.body.profilePhotoUrl).toBeTruthy();
    await request(app.getHttpServer())
      .get(first.body.profilePhotoUrl)
      .expect(200);
    const second = await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', '{}')
      .attach('profilePhoto', png, 'replacement.png')
      .expect(200);
    await request(app.getHttpServer())
      .get(first.body.profilePhotoUrl)
      .expect(404);
    await request(app.getHttpServer())
      .get(second.body.profilePhotoUrl)
      .expect(200);
    const ordinary = await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'edited@example.test' })
      .expect(200);
    await request(app.getHttpServer())
      .get(ordinary.body.profilePhotoUrl)
      .expect(200);
    const removed = await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ removeProfilePhoto: true })
      .expect(200);
    expect(removed.body.profilePhotoUrl).toBeNull();
    expect(removed.body.qualification).toBe('MDS');
    await request(app.getHttpServer())
      .get(second.body.profilePhotoUrl)
      .expect(404);
  });

  it('rejects invalid profile edits and limits photo changes to the signed-in verified dentist', async () => {
    const owner = await account('dentist');
    const created = await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', JSON.stringify(dentistDetails))
      .attach('profilePhoto', png, 'original.png')
      .expect(201);
    await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ removeProfilePhoto: true })
      .expect(403);
    await pool.query(
      "update dentists set status = 'verified' where user_id = $1",
      [owner.id],
    );
    await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', '{bad json')
      .attach('profilePhoto', png, 'invalid.png')
      .expect(400);
    await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', JSON.stringify({ removeProfilePhoto: true }))
      .attach('profilePhoto', png, 'conflicting.png')
      .expect(400);
    await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .field('details', JSON.stringify({ qualification: 'Should not save' }))
      .attach(
        'profilePhoto',
        Buffer.from('%PDF-1.4\nnot an avatar'),
        'report.pdf',
      )
      .expect(400);
    const unchanged = await request(app.getHttpServer())
      .get('/dentists/me')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(unchanged.body.qualification).toBe(dentistDetails.qualification);
    await request(app.getHttpServer())
      .get(created.body.profilePhotoUrl)
      .expect(200);
    const patient = await account();
    await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ removeProfilePhoto: true })
      .expect(403);
    const other = await account('dentist');
    await request(app.getHttpServer())
      .post('/dentists/applications')
      .set('Authorization', `Bearer ${other.token}`)
      .send(dentistDetails)
      .expect(201);
    await pool.query(
      "update dentists set status = 'verified' where user_id = $1",
      [other.id],
    );
    await request(app.getHttpServer())
      .patch('/dentists/me')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ removeProfilePhoto: true, userId: owner.id })
      .expect(200);
    await request(app.getHttpServer())
      .get(created.body.profilePhotoUrl)
      .expect(200);
  });

  it('stops serving a photo when its account is deactivated', async () => {
    const owner = await account();
    const created = await register(owner.token).expect(201);
    await pool.query("update users set status = 'locked' where id = $1", [
      owner.id,
    ]);
    await request(app.getHttpServer())
      .get(created.body.profilePhotoUrl)
      .expect(404);
  });
});
