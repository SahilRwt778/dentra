import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_DENTIST_KEY = 'allowUnverifiedDentist';

/** OTP proves ownership of a number; only onboarding is available until admin approval. */
export const AllowUnverifiedDentist = () => SetMetadata(ALLOW_UNVERIFIED_DENTIST_KEY, true);
