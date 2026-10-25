import { mkdir, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import type { KycDocType } from './dto/kyc-doc-type';

/**
 * TODO (Phase 6, pending S3 vendor decision — see DENTRA_ARCHITECTURE.md):
 * writes to local disk under ./uploads instead of S3. The function
 * signature (dentistId, docType, file) -> fileUrl is the whole surface
 * callers depend on, so swapping this for an S3 upload later touches
 * only this file, not dentists.service.ts.
 */
export async function storeDocument(
  dentistId: string,
  docType: KycDocType,
  file: { buffer: Buffer; originalname: string },
): Promise<string> {
  const dir = join(process.cwd(), 'uploads', 'dentists', dentistId);
  await mkdir(dir, { recursive: true });
  const ext = extname(file.originalname) || '.bin';
  const filename = `${docType}${ext}`;
  await writeFile(join(dir, filename), file.buffer);
  return `/uploads/dentists/${dentistId}/${filename}`;
}

/**
 * The reverse of storeDocument's path convention — resolves a stored
 * fileUrl (e.g. "/uploads/dentists/{id}/degree.pdf") back to an
 * absolute disk path. These files are KYC documents (government ID,
 * a selfie) — never served as static assets with a guessable URL;
 * always read through the authenticated download route in
 * applications.controller.ts.
 */
export function resolveDocumentPath(fileUrl: string): string {
  return join(process.cwd(), fileUrl);
}
