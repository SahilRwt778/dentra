import type { Pool } from 'pg';
import { PatientsService } from '../patients/patients.service';
import { DentistsService } from '../dentists/dentists.service';
import type { UsersService } from '../users/users.service';
import type { ProfilePhotosService } from './profile-photos.service';

describe.each(['patient', 'dentist'] as const)(
  '%s registration photo rollback',
  (role) => {
    const id = '11111111-1111-4111-8111-111111111111';
    const photo = { buffer: Buffer.from('synthetic-image') };
    const photos = { save: jest.fn(), removeUnused: jest.fn() };
    const users = { hasProfile: jest.fn(async () => false) };
    let failure: 'insert' | 'commit';
    const query = jest.fn(async (sql: string) => {
      if (
        sql.includes(
          `insert into ${role === 'patient' ? 'patients' : 'dentists'}`,
        )
      ) {
        if (failure === 'insert')
          throw new Error('Synthetic profile write failure');
        return { rows: [{ user_id: id }], rowCount: 1 };
      }
      if (sql === 'COMMIT' && failure === 'commit')
        throw new Error('Synthetic lost commit response');
      return { rows: [], rowCount: 0 };
    });
    const client = { query, release: jest.fn() };
    const pool = { connect: async () => client } as unknown as Pool;
    beforeEach(() => {
      jest.clearAllMocks();
      photos.save.mockResolvedValue('new-photo-reference');
      photos.removeUnused.mockResolvedValue(undefined);
    });
    function register() {
      const identity = users as unknown as UsersService;
      const storage = photos as unknown as ProfilePhotosService;
      if (role === 'patient')
        return new PatientsService(pool, identity, storage).register(
          id,
          {
            fullName: 'Synthetic patient',
            dateOfBirth: '1995-01-01',
            termsConsent: true,
            telemedicineConsent: true,
          },
          photo,
        );
      return new DentistsService(
        pool,
        identity,
        null as never,
        null as never,
        null as never,
        storage,
      ).createApplication(
        id,
        {
          fullName: 'Synthetic dentist',
          qualification: 'BDS',
          specialization: 'General Dentist',
          councilRegNo: 'SYNTHETIC',
          primaryClinicName: 'Test clinic',
          termsConsent: true,
          telemedicineConsent: true,
        },
        photo,
      );
    }
    it('removes the new image when the profile write fails', async () => {
      failure = 'insert';
      await expect(register()).rejects.toThrow(
        'Synthetic profile write failure',
      );
      expect(photos.removeUnused).toHaveBeenCalledWith(
        role,
        id,
        'new-photo-reference',
      );
      expect(query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalledTimes(1);
    });
    it('retains an image when a lost COMMIT response may have saved the profile', async () => {
      failure = 'commit';
      await expect(register()).rejects.toThrow(
        'Synthetic lost commit response',
      );
      expect(photos.removeUnused).not.toHaveBeenCalled();
      expect(client.release).toHaveBeenCalledTimes(1);
    });
  },
);
