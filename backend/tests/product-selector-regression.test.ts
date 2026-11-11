import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AreaService } from '../src/modules/areas/area.service.js';

describe('Product Selector Regression & Complete Inventory Workflow', () => {
  let app: any;
  let adminToken: string;
  let area1Id: string;
  let area2Id: string;
  let productId: string;
  let saleId: string;
  let saleLineId: string;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();

    // 1. Create admin user and obtain token
    await AuthService.createAdminIfNotExists(
      'admin@sifon.local',
      'Admin@Sifon2026!',
      'Admin User'
    );

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sifon.local', password: 'Admin@Sifon2026!' });

    adminToken = loginRes.body.data.token;

    // Create Area 1 and Area 2
    const a1 = await AreaService.createArea({ areaNumber: 1, description: 'Main Storage' });
    const a2 = await AreaService.createArea({ areaNumber: 2, description: 'Buffer Storage' });
    area1Id = a1._id.toString();
    area2Id = a2._id.toString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('Fix Verification: API accepts limit=200 for dropdown and selector queries without 422 error', async () => {
    const res = await request(app)
      .get('/api/v1/products?activeOnly=true&limit=200')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('Step 1 & 2: Create a product with zero initial stock and confirm it appears in selector query', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'REG-PROD-01',
        name: 'Industrial Valve 50mm',
        details: 'Zero initial stock product',
        unit: 'pcs',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    productId = res.body.data._id;

    // Verify it appears in active selector query with limit=200
    const listRes = await request(app)
      .get('/api/v1/products?activeOnly=true&limit=200')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const found = listRes.body.data.find((p: any) => p._id === productId);
    expect(found).toBeDefined();
    expect(found.code).toBe('REG-PROD-01');
    expect(found.name).toBe('Industrial Valve 50mm');
    expect(found.totalAvailable).toBe(0);
    expect(found.totalDamaged).toBe(0);
  });

  it('Step 3 & 4: Purchase and post 50 units into Area 1 -> Available stock becomes 50', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purchaseDate: '2026-11-10',
        items: [{ productId, receivingAreaId: area1Id, quantity: 50 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('POSTED');

    // Confirm product balance is now 50
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(50);
    expect(prodRes.body.data.totalDamaged).toBe(0);
  });

  it('Step 5 & 6: Select the product and Area 1 in a sale -> Sell and post 10 units -> Available becomes 40', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        saleDate: '2026-11-10',
        items: [{ productId, sourceAreaId: area1Id, quantity: 10 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('POSTED');
    saleId = res.body.data._id;
    saleLineId = res.body.data.items[0]._id;

    // Confirm available stock is 40
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(40);
  });

  it('Step 8 & 9: Return 2 non-damaged units and 1 damaged unit -> Available becomes 42, damaged becomes 1', async () => {
    // 1. Non-damaged return of 2 units
    const ret1 = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnDate: '2026-11-10',
        saleId,
        saleLineId,
        receivingAreaId: area1Id,
        nonDamagedQuantity: 2,
        damagedQuantity: 0,
        reason: 'Customer over-ordered',
      });
    expect(ret1.status).toBe(201);

    // 2. Damaged return of 1 unit
    const ret2 = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnDate: '2026-11-10',
        saleId,
        saleLineId,
        receivingAreaId: area1Id,
        nonDamagedQuantity: 0,
        damagedQuantity: 1,
        reason: 'Cosmetic damage reported upon delivery',
      });
    expect(ret2.status).toBe(201);

    // Confirm available = 42, damaged = 1
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(42);
    expect(prodRes.body.data.totalDamaged).toBe(1);
  });

  it('Step 10: Confirm dashboard and stock statement agree on balances (42 available, 1 damaged)', async () => {
    // Dashboard KPIs
    const dashRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.totalAvailableQuantity).toBe(42);
    expect(dashRes.body.data.totalDamagedQuantity).toBe(1);

    // Stock Matrix View A
    const matrixRes = await request(app)
      .get('/api/v1/reports/matrix')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(matrixRes.status).toBe(200);
    const row = matrixRes.body.data.rows.find((r: any) => r.product._id === productId);
    expect(row).toBeDefined();
    expect(row.totalAvailable).toBe(42);
    expect(row.totalDamaged).toBe(1);
    expect(row.areaQuantities[area1Id].available).toBe(42);
    expect(row.areaQuantities[area1Id].damaged).toBe(1);
  });

  it('Step 11: Confirm attempting to sell 43 units is rejected (available is only 42)', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        saleDate: '2026-11-10',
        items: [{ productId, sourceAreaId: area1Id, quantity: 43 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Insufficient available stock');

    // Confirm balance remains 42
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.body.data.totalAvailable).toBe(42);
  });

  it('Step 13: Confirm creating another product makes it immediately available in selector query', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'REG-PROD-02',
        name: 'Centrifugal Pump 2HP',
        unit: 'pcs',
      });

    expect(res.status).toBe(201);
    const prod2Id = res.body.data._id;

    // Immediately fetch dropdown query
    const listRes = await request(app)
      .get('/api/v1/products?activeOnly=true&limit=200')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    const found = listRes.body.data.find((p: any) => p._id === prod2Id);
    expect(found).toBeDefined();
    expect(found.code).toBe('REG-PROD-02');
  });

  it('Search beyond pagination: Server search finds products matching search term', async () => {
    const searchRes = await request(app)
      .get('/api/v1/products?activeOnly=true&search=Centrifugal')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.data[0].name).toContain('Centrifugal');
  });

  it('Idempotency: Re-submitting with the same idempotency key does not duplicate stock movements', async () => {
    const idempotencyKey = 'pur-reg-test-001';

    const res1 = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        purchaseDate: '2026-11-10',
        items: [{ productId, receivingAreaId: area2Id, quantity: 15 }],
      });

    expect(res1.status).toBe(201);

    // Replay exact same request with same key
    const res2 = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Idempotency-Key', idempotencyKey)
      .send({
        purchaseDate: '2026-11-10',
        items: [{ productId, receivingAreaId: area2Id, quantity: 15 }],
      });

    expect([200, 201]).toContain(res2.status);
    expect(res2.headers['x-cache-lookup']).toBe('IDEMPOTENT-HIT');

    // Confirm balance only increased by 15 once (in Area 2)
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Previously: Area 1 has 42. Area 2 now has 15. Total = 42 + 15 = 57.
    expect(prodRes.body.data.totalAvailable).toBe(57);
  });
});

