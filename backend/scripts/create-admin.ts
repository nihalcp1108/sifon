import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { env } from '../src/config/env.js';

async function main() {
  const email = process.env.ADMIN_EMAIL || env.INITIAL_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || env.INITIAL_ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || env.INITIAL_ADMIN_NAME || 'Super Admin';

  if (!email || !password) {
    console.error('Error: Please provide ADMIN_EMAIL and ADMIN_PASSWORD via environment variables.');
    process.exit(1);
  }

  try {
    await connectDatabase();
    console.log(`Creating/Verifying admin user: ${email}...`);
    const admin = await AuthService.createAdminIfNotExists(email, password, name);
    console.log(`Admin user ready: ${admin.email} (ID: ${admin._id})`);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

main();

