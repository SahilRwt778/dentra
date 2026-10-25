import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "@database/database.module";
import type { AuthenticatedUser } from "@common/decorators/current-user.decorator";
import { detectPatientFileType } from "./validate-patient-file";
import { PatientFilesStorage } from "./patient-files.storage";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 8;
type FileRow = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  content_hash: string;
  created_at: Date;
  expires_at: Date;
  deleted_at: Date | null;
  dentist_name?: string | null;
  scheduled_date?: string | null;
};
const visible =
  "f.deleted_at is null and (f.appointment_id is not null or f.expires_at > now())";

@Injectable()
export class PatientFilesService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly storage: PatientFilesStorage
  ) {}

  async upload(
    patientId: string,
    uploadKey: string,
    file: Express.Multer.File
  ) {
    const mime = detectPatientFileType(file.buffer);
    // Remove path separators and control characters from display/download names.
    const name =
      file.originalname
        .replace(/[\\/\p{Cc}]/gu, "_")
        .trim()
        .slice(0, 160) || "Attachment";
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const id = randomUUID();
    const client = await this.pool.connect();
    let stored = false;
    try {
      await client.query("BEGIN");
      const owner = await client.query(
        `select u.id from users u join patients p on p.user_id = u.id
         where u.id = $1 and u.status = 'active' for update of u`,
        [patientId]
      );
      if (!owner.rowCount)
        throw new NotFoundException("Patient account is unavailable.");
      const existing = await client.query<FileRow>(
        "select * from patient_files where patient_id = $1 and upload_key = $2 for update",
        [patientId, uploadKey]
      );
      if (existing.rows[0]) {
        const previous = existing.rows[0];
        if (
          previous.deleted_at ||
          (!previous.appointment_id &&
            previous.expires_at.getTime() <= Date.now())
        ) {
          throw new ConflictException(
            "This upload expired or was removed. Please select the file again."
          );
        }
        if (previous.content_hash !== hash)
          throw new ConflictException(
            "That upload key is already in use for another file."
          );
        await client.query("COMMIT");
        return this.metadata(previous);
      }
      const quota = await client.query<{ count: string }>(
        `select count(*) from patient_files f where f.patient_id = $1 and f.appointment_id is null and ${visible}`,
        [patientId]
      );
      if (Number(quota.rows[0].count) >= 20)
        throw new ConflictException(
          "Remove unused uploads before adding more files."
        );
      await this.storage.save(id, file.buffer);
      stored = true;
      const { rows } = await client.query<FileRow>(
        `insert into patient_files (id, patient_id, upload_key, file_name, mime_type, size_bytes, content_hash)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [id, patientId, uploadKey, name, mime, file.buffer.length, hash]
      );
      await client.query("COMMIT");
      return this.metadata(rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      if (stored) await this.storage.remove(id).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async list(patientId: string, page: number, appointmentId?: string) {
    const { rows } = await this.pool.query<FileRow>(
      `select f.*, d.full_name as dentist_name, a.scheduled_date from patient_files f
       join users u on u.id = f.patient_id and u.status = 'active'
       left join appointments a on a.id = f.appointment_id left join dentists d on d.user_id = a.dentist_id
       where f.patient_id = $1 and ${visible} ${
        appointmentId ? "and f.appointment_id = $4" : ""
      }
       order by f.created_at desc, f.id desc limit $2 offset $3`,
      appointmentId
        ? [patientId, 21, (page - 1) * 20, appointmentId]
        : [patientId, 21, (page - 1) * 20]
    );
    return {
      items: rows.slice(0, 20).map((row) => this.metadata(row)),
      nextPage: rows.length > 20 ? page + 1 : null,
    };
  }

  async appointmentFiles(user: AuthenticatedUser, appointmentId: string) {
    const own = await this.pool.query(
      `select a.id from appointments a join users u on u.id = $2 and u.status = 'active'
       where a.id = $1 and a.${
         user.role === "dentist" ? "dentist_id" : "patient_id"
       } = $2`,
      [appointmentId, user.userId]
    );
    if (!own.rowCount) throw new NotFoundException("No such appointment.");
    const { rows } = await this.pool.query<FileRow>(
      `select f.* from patient_files f where f.appointment_id = $1 and ${visible} order by f.created_at, f.id`,
      [appointmentId]
    );
    return rows.map((row) => this.metadata(row));
  }

  /** Binding is part of booking's transaction: failed bookings cannot share or consume uploads. */
  async attach(
    client: PoolClient,
    patientId: string,
    appointmentId: string,
    ids: string[]
  ) {
    if (!ids.length) return;
    if (ids.length > MAX_ATTACHMENTS || new Set(ids).size !== ids.length)
      throw new BadRequestException(
        "Choose up to eight different attachments."
      );
    const { rows } = await client.query<FileRow>(
      `select * from patient_files where id = any($1::uuid[]) order by id for update`,
      [ids]
    );
    if (
      rows.length !== ids.length ||
      rows.some(
        (row) =>
          row.patient_id !== patientId ||
          row.deleted_at ||
          row.appointment_id ||
          row.expires_at.getTime() <= Date.now()
      )
    ) {
      throw new ConflictException(
        "An attachment is unavailable or already belongs to another booking. Please select it again."
      );
    }
    await client.query(
      "update patient_files set appointment_id = $2 where id = any($1::uuid[])",
      [ids, appointmentId]
    );
  }

  async remove(patientId: string, id: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<FileRow>(
        "select * from patient_files where id = $1 and patient_id = $2 for update",
        [id, patientId]
      );
      if (!rows[0]) throw new NotFoundException("No such file.");
      if (rows[0].appointment_id)
        throw new ConflictException(
          "Attachments saved with a booking are part of its records."
        );
      await client.query(
        "update patient_files set deleted_at = coalesce(deleted_at, now()) where id = $1",
        [id]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async content(user: AuthenticatedUser, id: string) {
    const { rows } = await this.pool.query<FileRow>(
      `select f.* from patient_files f left join appointments a on a.id = f.appointment_id
       join users u on u.id = $2 and u.status = 'active'
       where f.id = $1 and ${visible} and ${
        user.role === "patient" ? "f.patient_id = $2" : "a.dentist_id = $2"
      }`,
      [id, user.userId]
    );
    if (!rows[0]) throw new NotFoundException("No such file.");
    try {
      return {
        file: this.metadata(rows[0]),
        bytes: await this.storage.read(id),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new NotFoundException("The stored file is unavailable.");
      throw error;
    }
  }

  private metadata(row: FileRow) {
    return {
      id: row.id,
      appointmentId: row.appointment_id,
      name: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      expiresAt: row.appointment_id ? null : row.expires_at,
      dentistName: row.dentist_name ?? null,
      appointmentDate: row.scheduled_date ?? null,
    };
  }
}
