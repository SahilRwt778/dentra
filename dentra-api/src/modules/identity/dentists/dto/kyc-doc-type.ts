/** Mirrors schema.sql's kyc_doc_type enum. */
export const KYC_DOC_TYPES = ['degree', 'council', 'id_proof', 'clinic_proof', 'insurance', 'selfie'] as const;
export type KycDocType = (typeof KYC_DOC_TYPES)[number];

export const REQUIRED_KYC_DOC_TYPES: readonly KycDocType[] = ['degree', 'council', 'id_proof', 'selfie'];
