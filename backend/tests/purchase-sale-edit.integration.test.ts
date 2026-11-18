import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Duplex } from 'stream';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/modules/auth/user.model.js';
import { PurchaseService } from '../src/modules/purchases/purchase.service.js';
import { SaleService } from '../src/modules/sales/sale.service.js';

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

describe('Purchase & Sale Edit Routes Express Integration Tests', () => {
  const app = createApp();

  const adminUserId = new mongoose.Types.ObjectId().toString();
  const viewerUserId = new mongoose.Types.ObjectId().toString();

  const adminToken = jwt.sign(
    { userId: adminUserId, email: 'admin@sandm.com', role: 'admin', tokenVersion: 1 },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const viewerToken = jwt.sign(
    { userId: viewerUserId, email: 'viewer@sandm.com', role: 'PRODUCT_VIEWER', tokenVersion: 0 },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(User, 'findById').mockImplementation((id: any) => {
      const idStr = id?.toString?.() || id;
      if (idStr === adminUserId) {
        return Promise.resolve({
          _id: new mongoose.Types.ObjectId(adminUserId),
          name: 'Admin User',
          email: 'admin@sandm.com',
          role: 'admin',
          isActive: true,
          tokenVersion: 1,
        }) as any;
      }
      if (idStr === viewerUserId) {
        return Promise.resolve({
          _id: new mongoose.Types.ObjectId(viewerUserId),
          email: 'viewer@sandm.com',
          role: 'PRODUCT_VIEWER',
          isActive: true,
          tokenVersion: 0,
        }) as any;
      }
      return Promise.resolve(null) as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. PUT /api/v1/purchases/:id rejects unauthenticated request with 401', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await dispatchRequest(app, 'PUT', `/api/v1/purchases/${fakeId}`, {}, {
      purchaseDate: '2026-11-17',
    });

    expect(res.status).toBe(401);
  });

  it('2. PUT /api/v1/purchases/:id rejects PRODUCT_VIEWER with 403', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await dispatchRequest(
      app,
      'PUT',
      `/api/v1/purchases/${fakeId}`,
      { Authorization: `Bearer ${viewerToken}` },
      {
        purchaseDate: '2026-11-17',
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(),
            receivingAreaId: new mongoose.Types.ObjectId().toString(),
            quantity: 10,
          },
        ],
      }
    );

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Admin access required/i);
  });

  it('3. PUT /api/v1/sales/:id rejects unauthenticated request with 401', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await dispatchRequest(app, 'PUT', `/api/v1/sales/${fakeId}`, {}, {
      saleDate: '2026-11-17',
    });

    expect(res.status).toBe(401);
  });

  it('4. PUT /api/v1/sales/:id rejects PRODUCT_VIEWER with 403', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await dispatchRequest(
      app,
      'PUT',
      `/api/v1/sales/${fakeId}`,
      { Authorization: `Bearer ${viewerToken}` },
      {
        saleDate: '2026-11-17',
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(),
            sourceAreaId: new mongoose.Types.ObjectId().toString(),
            quantity: 5,
          },
        ],
      }
    );

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Admin access required/i);
  });

  it('5. PUT /api/v1/purchases/:id rejects invalid payload with 422', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await dispatchRequest(
      app,
      'PUT',
      `/api/v1/purchases/${fakeId}`,
      { Authorization: `Bearer ${adminToken}` },
      {
        purchaseDate: 'not-a-date',
        items: [],
      }
    );

    expect(res.status).toBe(422);
  });

  it('6. PUT /api/v1/sales/:id rejects invalid payload with 422', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await dispatchRequest(
      app,
      'PUT',
      `/api/v1/sales/${fakeId}`,
      { Authorization: `Bearer ${adminToken}` },
      {
        saleDate: '2026-11-17',
        items: [
          {
            productId: new mongoose.Types.ObjectId().toString(),
            sourceAreaId: new mongoose.Types.ObjectId().toString(),
            quantity: -3,
          },
        ],
      }
    );

    expect(res.status).toBe(422);
  });

  it('7. PUT /api/v1/purchases/:id forwards valid request to PurchaseService.updatePurchase', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const mockUpdated = {
      _id: fakeId,
      reference: 'PO-2026-EDITED',
      status: 'POSTED',
      items: [],
    };

    const updateSpy = vi
      .spyOn(PurchaseService, 'updatePurchase')
      .mockResolvedValue(mockUpdated as any);

    const res = await dispatchRequest(
      app,
      'PUT',
      `/api/v1/purchases/${fakeId}`,
      { Authorization: `Bearer ${adminToken}` },
      {
        reference: 'PO-2026-EDITED',
        purchaseDate: '2026-11-17',
        notes: 'Test note',
      }
    );

    expect(res.status).toBe(200);
    expect(res.body.data.reference).toBe('PO-2026-EDITED');
    expect(updateSpy).toHaveBeenCalledWith(
      fakeId,
      expect.objectContaining({ reference: 'PO-2026-EDITED' }),
      adminUserId
    );
  });

  it('8. PUT /api/v1/sales/:id forwards valid request to SaleService.updateSale', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const mockUpdated = {
      _id: fakeId,
      reference: 'SO-2026-EDITED',
      status: 'POSTED',
      items: [],
    };

    const updateSpy = vi
      .spyOn(SaleService, 'updateSale')
      .mockResolvedValue(mockUpdated as any);

    const res = await dispatchRequest(
      app,
      'PUT',
      `/api/v1/sales/${fakeId}`,
      { Authorization: `Bearer ${adminToken}` },
      {
        reference: 'SO-2026-EDITED',
        saleDate: '2026-11-17',
        notes: 'Sale test note',
      }
    );

    expect(res.status).toBe(200);
    expect(res.body.data.reference).toBe('SO-2026-EDITED');
    expect(updateSpy).toHaveBeenCalledWith(
      fakeId,
      expect.objectContaining({ reference: 'SO-2026-EDITED' }),
      adminUserId
    );
  });
});
