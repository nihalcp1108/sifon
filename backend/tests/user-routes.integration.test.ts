import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Duplex } from 'stream';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/modules/auth/user.model.js';
import { AuditLog } from '../src/modules/audit/audit.model.js';

function dispatchRequest(
  app: any,
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; body: any; headers: any }> {
  return new Promise((resolve) => {
    const jsonStr = body !== undefined ? JSON.stringify(body) : undefined;
    const bodyBuf = jsonStr ? Buffer.from(jsonStr) : Buffer.alloc(0);

    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    const req: any = new http.IncomingMessage(socket as any);
    req.method = method;
    req.url = url;
    req.originalUrl = url;
    req.headers = {
      'content-type': 'application/json',
      'content-length': bodyBuf.length.toString(),
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    };
    req.connection = socket;
    req.socket = socket;
    req.ip = '127.0.0.1';

    if (bodyBuf.length > 0) {
      req.push(bodyBuf);
    }
    req.push(null);

    const res: any = new http.ServerResponse(req);
    let responseBody = '';

    res.write = (chunk: any) => {
      if (chunk) responseBody += chunk.toString();
      return true;
    };

    res.end = (chunk?: any) => {
      if (chunk) responseBody += chunk.toString();
      let parsed = responseBody;
      try {
        parsed = JSON.parse(responseBody);
      } catch {
        // Leave as string
      }
      resolve({ status: res.statusCode, body: parsed, headers: res.getHeaders() });
    };

    app.handle(req, res);
  });
}

describe('User Routes Express Integration Test (Full Router Pipeline in-memory)', () => {
  let app: any;

  const adminId = new mongoose.Types.ObjectId().toString();
  const viewerId = new mongoose.Types.ObjectId().toString();

  const adminUser = {
    _id: new mongoose.Types.ObjectId(adminId),
    id: adminId,
    email: 'superadmin@sandm.local',
    name: 'Super Admin',
    role: 'admin',
    isActive: true,
    tokenVersion: 1,
  };

  const viewerUser = {
    _id: new mongoose.Types.ObjectId(viewerId),
    id: viewerId,
    email: 'existingviewer@sandm.local',
    role: 'PRODUCT_VIEWER',
    isActive: true,
    tokenVersion: 0,
  };

  const adminToken = jwt.sign(
    { userId: adminId, email: adminUser.email, role: 'admin', tokenVersion: 1 },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const viewerToken = jwt.sign(
    { userId: viewerId, email: viewerUser.email, role: 'PRODUCT_VIEWER', tokenVersion: 0 },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    app = createApp();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. POST /api/v1/auth/users rejects unauthenticated requests with 401', async () => {
    const res = await dispatchRequest(app, 'POST', '/api/v1/auth/users', {}, {
      email: 'newviewer@sandm.local',
      password: 'password123',
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Authentication required/i);
  });

  it('2. POST /api/v1/auth/users rejects non-admin (PRODUCT_VIEWER) requests with 403', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(viewerUser as any);

    const res = await dispatchRequest(
      app,
      'POST',
      '/api/v1/auth/users',
      { Authorization: `Bearer ${viewerToken}` },
      { email: 'newviewer@sandm.local', password: 'password123' }
    );

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Admin access required/i);
  });

  it('3. POST /api/v1/auth/users validates input: rejects short password and invalid email with 422', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(adminUser as any);

    const resShort = await dispatchRequest(
      app,
      'POST',
      '/api/v1/auth/users',
      { Authorization: `Bearer ${adminToken}` },
      { email: 'valid@sandm.local', password: '123' }
    );
    expect(resShort.status).toBe(422);

    const resEmail = await dispatchRequest(
      app,
      'POST',
      '/api/v1/auth/users',
      { Authorization: `Bearer ${adminToken}` },
      { email: 'not-an-email', password: 'password123' }
    );
    expect(resEmail.status).toBe(422);
  });

  it('4. POST /api/v1/auth/users returns 409 Conflict when email already exists', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(adminUser as any);
    vi.spyOn(User, 'findOne').mockResolvedValue({ email: 'duplicate@sandm.local' } as any);

    const res = await dispatchRequest(
      app,
      'POST',
      '/api/v1/auth/users',
      { Authorization: `Bearer ${adminToken}` },
      { email: 'duplicate@sandm.local', password: 'password123' }
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('5. POST /api/v1/auth/users successfully creates viewer with ONLY email & password', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(adminUser as any);
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    const createdMockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'newviewer@sandm.local',
      role: 'PRODUCT_VIEWER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(User, 'create').mockResolvedValue(createdMockUser as any);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);

    const res = await dispatchRequest(
      app,
      'POST',
      '/api/v1/auth/users',
      { Authorization: `Bearer ${adminToken}` },
      {
        email: '  NEWVIEWER@SANDM.LOCAL  ',
        password: 'securePassword123',
      }
    );

    // Proves the route is registered and DOES NOT 404!
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('newviewer@sandm.local');
    expect(res.body.data.role).toBe('PRODUCT_VIEWER');
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.name).toBeUndefined();
  });

  it('6. POST /api/v1/users (alias endpoint) also successfully routes and creates viewer', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(adminUser as any);
    vi.spyOn(User, 'findOne').mockResolvedValue(null);

    const createdMockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'directviewer@sandm.local',
      role: 'PRODUCT_VIEWER',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(User, 'create').mockResolvedValue(createdMockUser as any);
    vi.spyOn(AuditLog, 'create').mockResolvedValue({} as any);

    const res = await dispatchRequest(
      app,
      'POST',
      '/api/v1/users',
      { Authorization: `Bearer ${adminToken}` },
      {
        email: 'directviewer@sandm.local',
        password: 'securePassword123',
      }
    );

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('directviewer@sandm.local');
    expect(res.body.data.role).toBe('PRODUCT_VIEWER');
  });

  it('7. Catch-all 404 properly triggers for non-existent routes', async () => {
    const res = await dispatchRequest(app, 'GET', '/api/v1/nonexistent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('The requested endpoint does not exist.');
  });

  it('8. Created Product Viewer can successfully log in via POST /api/v1/auth/login', async () => {
    const bcrypt = await import('bcryptjs');
    const salt = await bcrypt.default.genSalt(10);
    const passwordHash = await bcrypt.default.hash('viewerSecretPassword123', salt);

    const viewerInDb = {
      _id: new mongoose.Types.ObjectId(viewerId),
      id: viewerId,
      email: 'activeviewer@sandm.local',
      passwordHash,
      role: 'PRODUCT_VIEWER',
      isActive: true,
      tokenVersion: 0,
      save: vi.fn(),
    };
    vi.spyOn(User, 'findOne').mockResolvedValue(viewerInDb as any);

    const res = await dispatchRequest(app, 'POST', '/api/v1/auth/login', {}, {
      email: 'activeviewer@sandm.local',
      password: 'viewerSecretPassword123',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('PRODUCT_VIEWER');
    expect(res.body.data.token).toBeDefined();
  });

  it('9. Product Viewer cannot perform admin write actions (e.g. POST /api/v1/brands)', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue(viewerUser as any);

    const res = await dispatchRequest(
      app,
      'POST',
      '/api/v1/brands',
      { Authorization: `Bearer ${viewerToken}` },
      { name: 'Unauthorized Brand' }
    );

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Admin access required/i);
  });
});
