import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { User } from '../src/modules/auth/user.model.js';
import { AuditLog } from '../src/modules/audit/audit.model.js';

describe('Admin Account Settings Regression Suite', () => {
  let app: any;
  let adminToken: string;
  let adminUser: any;

  const initialEmail = 'admin@sifon.local';
  const initialPassword = 'InitialSecurePassword123!';
  const newEmail = 'updated.admin@sifon.company';
  const newPassword = 'new long secure passphrase with spaces 2026!';

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();

    // Seed initial admin
    adminUser = await AuthService.createAdminIfNotExists(
      initialEmail,
      initialPassword,
      'System Admin'
    );

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: initialEmail, password: initialPassword });

    adminToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('Rejects unauthenticated email change requests', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/email')
      .send({
        newEmail: 'hacker@sifon.local',
        currentPassword: 'anyPassword123',
      });

    expect(res.status).toBe(401);
  });

  it('Rejects unauthenticated password change requests', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/password')
      .send({
        currentPassword: 'anyPassword123',
        newPassword: 'newValidPassword123!',
        confirmPassword: 'newValidPassword123!',
      });

    expect(res.status).toBe(401);
  });

  it('Rejects email change with wrong current password', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newEmail: 'newadmin@sifon.local',
        currentPassword: 'WrongPassword999!',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid current password/i);
  });

  it('Rejects email change when new email is identical to current email', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newEmail: `  ${initialEmail.toUpperCase()}  `,
        currentPassword: initialPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/must be different/i);
  });

  it('Rejects email change if duplicate email already exists', async () => {
    // Create another user to collide with
    await User.create({
      email: 'another.user@sifon.local',
      passwordHash: 'dummyHash123',
      name: 'Another User',
      role: 'admin',
      isActive: true,
      tokenVersion: 0,
    });

    const res = await request(app)
      .put('/api/v1/auth/account/email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newEmail: 'another.user@sifon.local',
        currentPassword: initialPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('Successfully updates admin email, writes audit log, and invalidates existing token', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        newEmail: `  ${newEmail.toUpperCase()}  `,
        currentPassword: initialPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Email updated successfully/i);

    // Verify DB update
    const updatedUser = await User.findById(adminUser._id);
    expect(updatedUser?.email).toBe(newEmail);
    expect(updatedUser?.tokenVersion).toBe(1);

    // Verify Audit Log
    const audit = await AuditLog.findOne({
      entityType: 'AUTH',
      action: 'EMAIL_CHANGED',
      entityId: adminUser._id,
    });
    expect(audit).toBeDefined();
    expect(audit?.details?.previousEmail).toBe(initialEmail);
    expect(audit?.details?.newEmail).toBe(newEmail);

    // Verify session invalidation: OLD token must now be rejected
    const testMeOldToken = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(testMeOldToken.status).toBe(401);
    expect(testMeOldToken.body.message).toMatch(/Session has been invalidated/i);

    // Verify login with old email fails
    const oldEmailLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: initialEmail, password: initialPassword });
    expect(oldEmailLogin.status).toBe(401);

    // Verify login with new email succeeds
    const newEmailLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newEmail, password: initialPassword });
    expect(newEmailLogin.status).toBe(200);

    // Update adminToken for subsequent password tests
    adminToken = newEmailLogin.body.data.token;
  });

  it('Seed guard: createAdminIfNotExists preserves updated admin and does not recreate original admin', async () => {
    const seedResult = await AuthService.createAdminIfNotExists(
      initialEmail,
      initialPassword,
      'System Admin'
    );

    // Must return the existing admin rather than creating an extra one
    expect(seedResult.email).toBe(newEmail);

    // Check count of admin users in database: must only be 2 (admin + another.user)
    const adminCount = await User.countDocuments({ role: 'admin' });
    expect(adminCount).toBe(2);
  });

  it('Rejects password change with wrong current password', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: 'WrongCurrentPassword123!',
        newPassword: newPassword,
        confirmPassword: newPassword,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid current password/i);
  });

  it('Rejects password change when reusing current password', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: initialPassword,
        confirmPassword: initialPassword,
      });

    // Zod schema validation catches identical current and new password with 422
    expect([400, 422]).toContain(res.status);
    expect(JSON.stringify(res.body)).toMatch(/cannot be the same/i);
  });

  it('Rejects password change with mismatched confirmation or short password', async () => {
    const resMismatch = await request(app)
      .put('/api/v1/auth/account/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: 'validLongPassword123!',
        confirmPassword: 'differentPassword123!',
      });

    expect(resMismatch.status).toBe(422);

    const resShort = await request(app)
      .put('/api/v1/auth/account/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: 'short',
        confirmPassword: 'short',
      });

    expect(resShort.status).toBe(422);
  });

  it('Successfully updates admin password, writes audit log, and invalidates existing session', async () => {
    const res = await request(app)
      .put('/api/v1/auth/account/password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: newPassword,
        confirmPassword: newPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Password updated successfully/i);

    // Verify DB update
    const updatedUser = await User.findById(adminUser._id);
    expect(updatedUser?.tokenVersion).toBe(2);

    // Verify Audit Log
    const audit = await AuditLog.findOne({
      entityType: 'AUTH',
      action: 'PASSWORD_CHANGED',
      entityId: adminUser._id,
    });
    expect(audit).toBeDefined();

    // Verify session invalidation: OLD token must now be rejected
    const testMeOldToken = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(testMeOldToken.status).toBe(401);
    expect(testMeOldToken.body.message).toMatch(/Session has been invalidated/i);

    // Verify login with old password fails
    const oldPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newEmail, password: initialPassword });
    expect(oldPasswordLogin.status).toBe(401);

    // Verify login with new password succeeds
    const newPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newEmail, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);
    expect(newPasswordLogin.body.data.token).toBeDefined();
  });
});

