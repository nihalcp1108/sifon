// Increase libuv threadpool size before async I/O / crypto tasks
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '16';

import './config/env.js';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env, validateEnv } from './config/env.js';
import { AuthService } from './modules/auth/auth.service.js';

async function bootstrap() {
  try {
    console.log(`[Sifon] Starting backend in "${env.NODE_ENV}" mode...`);

    // 1. Validate environment variables before initializing services
    validateEnv();

    // 2. Connect to MongoDB Atlas (or configured replica set)
    await connectDatabase();

    // 3. Auto-create initial admin if requested in environment
    if (env.INITIAL_ADMIN_EMAIL && env.INITIAL_ADMIN_PASSWORD) {
      try {
        await AuthService.createAdminIfNotExists(
          env.INITIAL_ADMIN_EMAIL,
          env.INITIAL_ADMIN_PASSWORD,
          env.INITIAL_ADMIN_NAME
        );
      } catch (adminErr) {
        console.warn('[Bootstrap] Initial admin creation note:', adminErr);
      }
    }

    const app = createApp();
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[Sifon] Server running on http://0.0.0.0:${env.PORT}`);
      console.log(`[Sifon] API Base URL: http://localhost:${env.PORT}/api/v1`);
      console.log(`[Sifon] Business Timezone: ${env.TIMEZONE}`);
      console.log(`[Sifon] Allowed Frontend Origin: ${env.FRONTEND_URL}`);
    });

    // Graceful shutdown handling
    const handleShutdown = async (signal: string) => {
      console.log(`\n[Sifon] Received ${signal}. Closing HTTP server...`);
      server.close(async () => {
        console.log('[Sifon] HTTP server closed. Disconnecting database...');
        await disconnectDatabase();
        console.log('[Sifon] Cleanup complete. Exiting.');
        process.exit(0);
      });

      // Force shutdown after 10s if hung
      setTimeout(() => {
        console.error('[Sifon] Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error: any) {
    console.error('\n[Sifon Startup Aborted]');
    console.error(error.message);
    process.exit(1);
  }
}

bootstrap();
