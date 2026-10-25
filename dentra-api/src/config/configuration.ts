/**
 * One typed accessor for every env var the app reads. Nothing calls
 * process.env directly outside this file — so a renamed or missing
 * variable fails at startup, in one place, not at random inside a
 * request handler three modules away.
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  patientFilesDirectory: string;
  dentistFilesDirectory: string;
  storage: {
    provider: 'local' | 'supabase';
    url: string;
    secretKey: string;
    bucket: string;
  };
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  otp: {
    hashSecret: string;
    ttlSeconds: number;
    resendCooldownSeconds: number;
    maxRequestsPerHour: number;
    maxVerifyAttempts: number;
    lockoutMinutes: number;
  };
  push: { enabled: boolean; projectId?: string };
  video: {
    enabled: boolean;
    serverUrl: string;
    publicUrl?: string;
    apiKey: string;
    apiSecret: string;
  };
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: required('DATABASE_URL'),
  patientFilesDirectory:
    process.env.PATIENT_FILES_DIRECTORY ?? `${process.cwd()}/uploads/patients`,
  dentistFilesDirectory:
    process.env.DENTIST_FILES_DIRECTORY ?? `${process.cwd()}/uploads/dentists`,
  storage: storageConfiguration(),
  // Every browser client (dentra-web-admin today, dentra-web-dentist
  // later) is a separate origin from this API — without this, the
  // browser blocks every request before it even reaches a route, no
  // matter how correct the request is. curl/Postman never show this:
  // CORS is enforced by the browser, not the server's own test tools.
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:5175'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  otp: {
    // Pepper for hashing OTP codes at rest — deliberately separate from
    // the JWT secret so rotating one doesn't invalidate the other.
    hashSecret: required('OTP_HASH_SECRET'),
    ttlSeconds: 300,
    resendCooldownSeconds: 30,
    maxRequestsPerHour: 5,
    maxVerifyAttempts: 5,
    lockoutMinutes: 15,
  },
  // The Firebase SDK reads GOOGLE_APPLICATION_CREDENTIALS directly from the server environment.
  push: {
    enabled: process.env.PUSH_ENABLED === 'true',
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  },
  video: {
    enabled: process.env.VIDEO_ENABLED === 'true',
    serverUrl: process.env.LIVEKIT_URL ?? '',
    publicUrl: process.env.LIVEKIT_PUBLIC_URL || undefined,
    apiKey: process.env.LIVEKIT_API_KEY ?? '',
    apiSecret: process.env.LIVEKIT_API_SECRET ?? '',
  },
  razorpay: {
    keyId: required('RAZORPAY_KEY_ID'),
    keySecret: required('RAZORPAY_KEY_SECRET'),
    // Separate from keySecret: signs the Checkout handshake vs. signs
    // webhook deliveries — rotating one independently of the other
    // (e.g. after a webhook URL change) shouldn't touch order creation.
    webhookSecret: required('RAZORPAY_WEBHOOK_SECRET'),
  },
});

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key} (see .env.example)`);
  }
  return value;
}

function storageConfiguration(): AppConfig['storage'] {
  const provider = process.env.STORAGE_PROVIDER ?? 'local';
  if (provider !== 'local' && provider !== 'supabase')
    throw new Error('STORAGE_PROVIDER must be local or supabase.');
  const url = process.env.SUPABASE_URL ?? '';
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'dentra-private';
  if (provider === 'supabase') {
    if (!url || !secretKey)
      throw new Error(
        'Supabase storage requires SUPABASE_URL and SUPABASE_SECRET_KEY.'
      );
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    )
      throw new Error('SUPABASE_URL must be the HTTPS project URL.');
    if (secretKey.startsWith('sb_publishable_'))
      throw new Error(
        'SUPABASE_SECRET_KEY must be a server secret key, not a publishable key.'
      );
  }
  return { provider, url, secretKey, bucket };
}
