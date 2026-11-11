import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Multi-path resolution ensures backend/.env is found whether running from
// backend/, project root c:\sifon, or compiled dist/
const configDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const candidateEnvPaths = [
  path.resolve(configDir, '../../.env'), // resolves to backend/.env from src/config or dist/config
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '.env'),
];

let loadedEnvPath: string | null = null;
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    loadedEnvPath = envPath;
    break;
  }
}

/**
 * Normalizes a MongoDB URI string by trimming whitespace, removing enclosing quotes,
 * and stripping any accidental duplicate "MONGODB_URI=" key prefix.
 */
export function normalizeMongoUri(raw?: string): string {
  if (!raw) return '';
  let uri = raw.trim();

  // Strip enclosing single or double quotes
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }

  // Strip duplicate key prefix if the user pasted "MONGODB_URI=mongodb+srv://..."
  while (/^MONGODB_URI\s*=\s*/i.test(uri)) {
    uri = uri.replace(/^MONGODB_URI\s*=\s*/i, '').trim();
    if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
      uri = uri.slice(1, -1).trim();
    }
  }

  return uri;
}

// Canonical Atlas placeholder tokens that indicate unconfigured template values
const TEMPLATE_MARKERS = [
  'YOUR_DB_USERNAME',
  'YOUR_URL_ENCODED_PASSWORD',
  'YOUR_ATLAS_CLUSTER_HOST',
  'YOUR_CLUSTER_HOST',
  'YOUR_USERNAME',
  'YOUR_PASSWORD',
  '<db_username>',
  '<db_password>',
  '<username>',
  '<password>',
  '<db_name>',
  '<cluster_address>',
  '<cluster-host>',
  '<cluster-name>',
];

/**
 * Checks whether the given URI contains unconfigured template placeholders.
 * Rejects actual template markers such as <db_username>, <db_password>, YOUR_DB_USERNAME,
 * YOUR_URL_ENCODED_PASSWORD, and YOUR_ATLAS_CLUSTER_HOST without rejecting valid credentials
 * through overly broad matching.
 */
export function isPlaceholderUri(uri?: string): boolean {
  if (!uri) return false;
  const normalized = normalizeMongoUri(uri);

  // Check known exact placeholder tokens
  for (const marker of TEMPLATE_MARKERS) {
    if (normalized.includes(marker)) {
      return true;
    }
  }

  // Check for unreplaced angle bracket template markers (e.g. <something>)
  // In a valid MongoDB connection string, unencoded '<' or '>' characters are illegal.
  if (normalized.includes('<') || normalized.includes('>')) {
    return true;
  }

  return false;
}

/**
 * Sanitizes a MongoDB connection URI to mask credentials for safe logging.
 * Replaces username:password with ****:****.
 */
export function sanitizeMongoUri(uri?: string): string {
  if (!uri) return '(empty)';
  const normalized = normalizeMongoUri(uri);
  return normalized.replace(
    /(mongodb(?:\+srv)?:\/\/)([^:@\s]+):([^@\s]+)@/i,
    '$1****:****@'
  );
}

/**
 * Application environment configuration object.
 * Uses property getters to dynamically read from process.env, preventing stale or
 * prematurely evaluated values if modules import env before dotenv finishes loading.
 */
export const env = {
  get NODE_ENV(): string {
    return (process.env.NODE_ENV || 'development').trim();
  },
  get PORT(): number {
    return parseInt(process.env.PORT || '5000', 10);
  },
  get MONGODB_URI(): string {
    return normalizeMongoUri(process.env.MONGODB_URI);
  },
  get JWT_SECRET(): string {
    return (process.env.JWT_SECRET || '').trim();
  },
  get JWT_EXPIRES_IN(): string {
    return (process.env.JWT_EXPIRES_IN || '7d').trim();
  },
  get COOKIE_SECRET(): string {
    return (process.env.COOKIE_SECRET || '').trim();
  },
  get FRONTEND_URL(): string {
    return (process.env.FRONTEND_URL || 'http://localhost:5173').trim();
  },
  get TIMEZONE(): string {
    return (process.env.TIMEZONE || 'Asia/Kolkata').trim();
  },
  get INITIAL_ADMIN_EMAIL(): string {
    return (process.env.INITIAL_ADMIN_EMAIL || 'admin@sifon.local').trim();
  },
  get INITIAL_ADMIN_PASSWORD(): string {
    return (process.env.INITIAL_ADMIN_PASSWORD || 'Admin@Sifon2026!').trim();
  },
  get INITIAL_ADMIN_NAME(): string {
    return (process.env.INITIAL_ADMIN_NAME || 'Super Admin').trim();
  },
  get loadedEnvPath(): string | null {
    return loadedEnvPath;
  },
};

/**
 * Validates required backend variables at startup.
 * Throws explicit configuration errors for missing or placeholder settings.
 */
export function validateEnv(options: { allowTestBypass?: boolean } = {}): void {
  const isTest = env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  if (isTest && options.allowTestBypass) {
    return;
  }

  const errors: string[] = [];

  // 1. Validate PORT
  if (isNaN(env.PORT) || env.PORT <= 0 || env.PORT > 65535) {
    errors.push(`PORT must be a valid positive integer between 1 and 65535 (current: "${process.env.PORT}")`);
  }

  // 2. Validate MONGODB_URI
  const uri = env.MONGODB_URI;
  if (!uri) {
    errors.push(
      'MONGODB_URI is required but not configured. Set MONGODB_URI in backend/.env with your MongoDB Atlas connection string.'
    );
  } else if (isPlaceholderUri(uri)) {
    errors.push(
      'MONGODB_URI contains unconfigured template placeholders (e.g. <db_username>, <db_password>, YOUR_DB_USERNAME, YOUR_URL_ENCODED_PASSWORD, or YOUR_ATLAS_CLUSTER_HOST). ' +
      'Please update backend/.env with your real MongoDB Atlas credentials.'
    );
  } else if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    errors.push(
      `MONGODB_URI must begin with "mongodb://" or "mongodb+srv://" (received prefix: "${uri.substring(0, 15)}...")`
    );
  }

  // 3. Validate Authentication Secrets
  if (!env.JWT_SECRET) {
    errors.push('JWT_SECRET is required but not set in backend/.env.');
  } else if (env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long for cryptographic security.');
  }

  if (!env.COOKIE_SECRET) {
    errors.push('COOKIE_SECRET is required but not set in backend/.env.');
  }

  // 4. Validate Frontend Origin
  if (!env.FRONTEND_URL) {
    errors.push('FRONTEND_URL is required for explicit CORS allowlisting.');
  }

  if (errors.length > 0) {
    const message = [
      '=================================================================',
      '  SIFON BACKEND CONFIGURATION VALIDATION FAILED',
      '=================================================================',
      ...errors.map((err, i) => `${i + 1}. ${err}`),
      '=================================================================',
    ].join('\n');
    throw new Error(message);
  }
}
