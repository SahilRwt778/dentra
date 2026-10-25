import { BadRequestException } from '@nestjs/common';

export const MAX_PRIVATE_FILE_BYTES = 10 * 1024 * 1024;
export type PrivateFileType = 'image/jpeg' | 'image/png' | 'application/pdf';

export function detectPrivateFileType(bytes: Buffer): PrivateFileType {
  if (!bytes.length || bytes.length > MAX_PRIVATE_FILE_BYTES)
    throw new BadRequestException('Files must be between 1 byte and 10 MB.');
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return 'image/jpeg';
  if (/^%PDF-\d\.\d/.test(bytes.subarray(0, 8).toString('ascii')))
    return 'application/pdf';
  throw new BadRequestException('Choose a JPEG/PNG photo or PDF report.');
}

export function privateFileExtension(type: PrivateFileType) {
  return type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'pdf';
}
