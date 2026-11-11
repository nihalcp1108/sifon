import dns from 'dns';
import mongoose from 'mongoose';
import { env, isPlaceholderUri, sanitizeMongoUri, normalizeMongoUri } from './env.js';

// Configure resilient DNS resolution for MongoDB Atlas SRV / TXT queries
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Graceful fallback to OS resolver
}

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  const targetUri = normalizeMongoUri(uri || env.MONGODB_URI);

  // Distinguish configuration errors from database connection failures
  if (!targetUri) {
    const errorMsg =
      '[Configuration Error] MONGODB_URI is not set. Please configure MONGODB_URI in backend/.env.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (isPlaceholderUri(targetUri)) {
    const errorMsg =
      '[Configuration Error] MONGODB_URI contains unconfigured template placeholders.\n' +
      'Please replace template markers (e.g. <db_username>, <db_password>, YOUR_DB_USERNAME, YOUR_URL_ENCODED_PASSWORD, or YOUR_ATLAS_CLUSTER_HOST)\n' +
      'in backend/.env with your real MongoDB Atlas connection string.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const safeTarget = sanitizeMongoUri(targetUri);
  console.log(`[MongoDB] Connecting to ${safeTarget}...`);

  try {
    mongoose.set('strictQuery', true);

    // Event listeners to handle auto-reconnect and monitor connection health
    if (!mongoose.connection.listenerCount('disconnected')) {
      mongoose.connection.on('disconnected', () => {
        console.warn('[MongoDB] Connection dropped or disconnected. Auto-reconnecting...');
      });
      mongoose.connection.on('reconnected', () => {
        console.log('[MongoDB] Connection re-established successfully.');
      });
      mongoose.connection.on('error', (err) => {
        console.error('[MongoDB] Connection runtime error:', err.message);
      });
    }

    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 25,
      minPoolSize: 2,
      heartbeatFrequencyMS: 10000,
      retryWrites: true,
      retryReads: true,
    });
    console.log(
      `[MongoDB] Connected successfully to database "${conn.connection.name}" on host "${conn.connection.host}"`
    );
    return conn;
  } catch (error: any) {
    console.error(`[MongoDB Connection Error] Could not establish connection to ${safeTarget}:`, error.message);
    if (error.name === 'MongoServerSelectionError') {
      console.error(
        '\nAtlas Connection Troubleshooting Checklist:\n' +
        ' 1. IP Whitelist: Go to Atlas > Network Access, ensure your current IP address (or 0.0.0.0/0) is active.\n' +
        ' 2. Credentials: Go to Atlas > Database Access, verify the database username and password.\n' +
        ' 3. URL-Encoding: If your password contains special characters (like @, #, $, %, etc.), URL-encode them (e.g. "@" becomes "%40").\n' +
        ' 4. Database Name: Ensure "sifon" is specified in the URI path before the query parameters.\n'
      );
    }
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
