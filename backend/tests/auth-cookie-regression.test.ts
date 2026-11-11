import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

describe('Auth Cookie & Cross-Site Production Regression Suite', () => {
  let app: any;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();

    // Create test admin
    await AuthService.createAdminIfNotExists(
      'admin@sifon.local',
      'Admin@Sifon2026!',
      'Super Admin'
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('1. Login returns user and token, and sets sifon_token cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@sifon.local',
        password: 'Admin@Sifon2026!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@sifon.local');
    expect(res.body.data.token).toBeDefined();

    // Check Set-Cookie header
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
    expect(cookieStr).toContain('sifon_token=');
    expect(cookieStr.toLowerCase()).toContain('httponly');
    expect(cookieStr.toLowerCase()).toContain('path=/');
  });

  it('2. Authenticates /auth/me via Cookie', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@sifon.local',
        password: 'Admin@Sifon2026!',
      });

    const cookies = loginRes.headers['set-cookie'];

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookies);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe('admin@sifon.local');
    expect(meRes.body.data.token).toBeDefined();
  });

  it('3. Authenticates /auth/me via Bearer Token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@sifon.local',
        password: 'Admin@Sifon2026!',
      });

    const token = loginRes.body.data.token;

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe('admin@sifon.local');
  });

  it('4. Rejects /auth/me without credentials with 401', async () => {
    const meRes = await request(app).get('/api/v1/auth/me');
    expect(meRes.status).toBe(401);
    expect(meRes.body.success).toBe(false);
  });

  it('5. Logout clears sifon_token cookie with matching attributes', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@sifon.local',
        password: 'Admin@Sifon2026!',
      });

    const cookies = loginRes.headers['set-cookie'];

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookies)
      .set('X-Requested-With', 'XMLHttpRequest');

    expect(logoutRes.status).toBe(200);
    const clearCookie = logoutRes.headers['set-cookie'];
    expect(clearCookie).toBeDefined();
    const clearCookieStr = Array.isArray(clearCookie) ? clearCookie.join(';') : clearCookie;
    expect(clearCookieStr).toContain('sifon_token=;');
  });
});
