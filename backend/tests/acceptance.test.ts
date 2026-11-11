import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AreaService } from '../src/modules/areas/area.service.js';

describe('Final Acceptance Scenario', () => {
  let app: any;
  let adminToken: string;
  let adminCookie: string;
  let area1Id: string;
  let area2Id: string;
  let productId: string;
  let saleId: string;
  let saleLineId: string;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();

    // 1. Create admin user
    const admin = await AuthService.createAdminIfNotExists(
      'admin@sifon.local',
      'Admin@Sifon2026!',
      'Admin User'
    );

    // Login to get token & cookie
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sifon.local', password: 'Admin@Sifon2026!' });

    adminToken = loginRes.body.data.token;
    adminCookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0] : '';

    // Create Area 1 and Area 2
    const a1 = await AreaService.createArea({ areaNumber: 1, description: 'Acceptance Area 1' });
    const a2 = await AreaService.createArea({ areaNumber: 2, description: 'Acceptance Area 2' });
    area1Id = a1._id.toString();
    area2Id = a2._id.toString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('Step 1: Create a product with opening stock of 100 units in Area 1', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'ACCEPT-PROD-01',
        name: 'Acceptance Product',
        unit: 'pcs',
        openingStock: [{ areaId: area1Id, quantity: 100 }],
      });

    expect(res.status).toBe(201);
    productId = res.body.data._id;

    // Verify balance
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(100);
    expect(prodRes.body.data.totalDamaged).toBe(0);
  });

  it('Step 2: Purchase 50 units into Area 1 -> Available stock becomes 150', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purchaseDate: '2026-11-06',
        items: [{ productId, receivingAreaId: area1Id, quantity: 50 }],
      });

    expect(res.status).toBe(201);

    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(150);
  });

  it('Step 3: Sell 30 units from Area 1 -> Available stock becomes 120', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        saleDate: '2026-11-06',
        items: [{ productId, sourceAreaId: area1Id, quantity: 30 }],
      });

    expect(res.status).toBe(201);
    saleId = res.body.data._id;
    saleLineId = res.body.data.items[0]._id;

    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(120);
  });

  it('Step 4: Return 5 non-damaged units against that sale -> Available stock becomes 125', async () => {
    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnDate: '2026-11-06',
        saleId,
        saleLineId,
        receivingAreaId: area1Id,
        nonDamagedQuantity: 5,
        damagedQuantity: 0,
        reason: 'Customer ordered extra',
      });

    expect(res.status).toBe(201);

    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(125);
    expect(prodRes.body.data.totalDamaged).toBe(0);
  });

  it('Step 5: Return 3 damaged units against that sale -> Available stock remains 125, Damaged becomes 3', async () => {
    const res = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnDate: '2026-11-06',
        saleId,
        saleLineId,
        receivingAreaId: area1Id,
        nonDamagedQuantity: 0,
        damagedQuantity: 3,
        reason: 'Defective item from factory batch',
      });

    expect(res.status).toBe(201);

    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(125);
    expect(prodRes.body.data.totalDamaged).toBe(3);
  });

  it('Step 6: Confirm total active returns are 8 units and remaining returnable quantity is 22', async () => {
    const saleRes = await request(app)
      .get(`/api/v1/sales/${saleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const item = saleRes.body.data.items.find((i: any) => i._id === saleLineId);
    expect(item.returnedQuantity).toBe(8); // 5 + 3 = 8
    const remaining = item.quantity - item.returnedQuantity; // 30 - 8 = 22
    expect(remaining).toBe(22);
  });

  it('Step 7: Confirm Area 2 is unaffected', async () => {
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    const area2Balance = prodRes.body.data.balances.find((b: any) => b.areaId._id === area2Id);
    if (area2Balance) {
      expect(area2Balance.availableQuantity).toBe(0);
      expect(area2Balance.damagedQuantity).toBe(0);
    }
  });

  it('Step 8: Confirm the stock statement matches these values', async () => {
    const matrixRes = await request(app)
      .get('/api/v1/reports/matrix')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(matrixRes.status).toBe(200);
    const row = matrixRes.body.data.rows.find((r: any) => r.product._id === productId);
    expect(row).toBeDefined();
    expect(row.totalAvailable).toBe(125);
    expect(row.totalDamaged).toBe(3);
    expect(row.areaQuantities[area1Id].available).toBe(125);
    expect(row.areaQuantities[area1Id].damaged).toBe(3);
  });

  it('Step 9: Confirm attempting to sell 126 units from Area 1 fails', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        saleDate: '2026-11-06',
        items: [{ productId, sourceAreaId: area1Id, quantity: 126 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Insufficient available stock');
  });

  it('Step 10: Confirm submitting the same return request again with the same idempotency key does not change balances', async () => {
    const idempotencyKey = 'idempotent-return-key-1001';

    const payload = {
      returnDate: '2026-11-06',
      saleId,
      saleLineId,
      receivingAreaId: area1Id,
      nonDamagedQuantity: 2,
      damagedQuantity: 0,
      reason: 'Idempotency test return',
    };

    // First request
    const firstRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(firstRes.status).toBe(201);
    const firstReturnId = firstRes.body.data._id;

    // Check balances: available was 125 + 2 = 127
    let prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.body.data.totalAvailable).toBe(127);

    // Second request with exact same idempotency key & payload
    const secondRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data._id).toBe(firstReturnId);
    expect(secondRes.headers['x-cache-lookup']).toBe('IDEMPOTENT-HIT');

    // Verify stock did NOT change twice!
    prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.body.data.totalAvailable).toBe(127);
  });
});

