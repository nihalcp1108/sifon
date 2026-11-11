import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AreaService } from '../src/modules/areas/area.service.js';

describe('Purchase and Sale Saving Regression Suite', () => {
  let app: any;
  let adminToken: string;
  let area1Id: string;
  let area2Id: string;
  let productId: string;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();

    // 1. Create admin user
    await AuthService.createAdminIfNotExists(
      'admin@sifon.local',
      'Admin@Sifon2026!',
      'Admin User'
    );

    // Login to get token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sifon.local', password: 'Admin@Sifon2026!' });

    adminToken = loginRes.body.data.token;

    // Create warehouse areas
    const a1 = await AreaService.createArea({ areaNumber: 1, description: 'Receiving Area 1' });
    const a2 = await AreaService.createArea({ areaNumber: 2, description: 'Receiving Area 2' });
    area1Id = a1._id.toString();
    area2Id = a2._id.toString();

    // Create product with initial 100 units in Area 1
    const pRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'PUR-REG-PROD',
        name: 'Regression Product',
        unit: 'pcs',
        openingStock: [{ areaId: area1Id, quantity: 100 }],
      });

    productId = pRes.body.data._id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('1. Purchase with empty string reference ("") auto-generates reference and increases stock', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reference: '', // User left reference input blank
        purchaseDate: '2026-11-11',
        items: [{ productId, receivingAreaId: area1Id, quantity: 50 }],
        isDraft: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toMatch(/^PUR-20261111-\d{4}$/);
    expect(res.body.data.status).toBe('POSTED');

    // Confirm available stock increased from 100 to 150
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(150);
  });

  it('2. Purchase with isDraft: true creates draft and does not increase stock', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reference: '',
        purchaseDate: '2026-11-11',
        items: [{ productId, receivingAreaId: area1Id, quantity: 25 }],
        isDraft: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    const draftId = res.body.data._id;

    // Available stock must remain 150
    const prodRes1 = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes1.body.data.totalAvailable).toBe(150);

    // Now post the draft and verify stock increases by 25 to 175
    const postRes = await request(app)
      .post(`/api/v1/purchases/${draftId}/post`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(postRes.status).toBe(200);
    expect(postRes.body.data.status).toBe('POSTED');

    const prodRes2 = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes2.body.data.totalAvailable).toBe(175);
  });

  it('3. Purchase with invalid quantity (e.g. 0 or negative) returns 422 with structured field error', async () => {
    const res = await request(app)
      .post('/api/v1/purchases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reference: '',
        purchaseDate: '2026-11-11',
        items: [{ productId, receivingAreaId: area1Id, quantity: 0 }],
        isDraft: false,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'items.0.quantity',
        }),
      ])
    );

    // Stock must not change
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(175);
  });

  it('4. Sale with empty string reference ("") auto-generates reference and reduces stock', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reference: '', // User left reference input blank
        saleDate: '2026-11-11',
        items: [{ productId, sourceAreaId: area1Id, quantity: 30 }],
        isDraft: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toMatch(/^SAL-20261111-\d{4}$/);
    expect(res.body.data.status).toBe('POSTED');

    // Confirm available stock reduced from 175 to 145
    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(145);
  });

  it('5. Sale with isDraft: true creates draft and does not reduce stock until posted', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reference: '',
        saleDate: '2026-11-11',
        items: [{ productId, sourceAreaId: area1Id, quantity: 20 }],
        isDraft: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    const draftId = res.body.data._id;

    // Stock still 145
    const prodRes1 = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes1.body.data.totalAvailable).toBe(145);

    // Post draft
    const postRes = await request(app)
      .post(`/api/v1/sales/${draftId}/post`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(postRes.status).toBe(200);

    // Stock becomes 125
    const prodRes2 = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes2.body.data.totalAvailable).toBe(125);
  });

  it('6. Attempting to oversell beyond available stock returns 400 without changing stock', async () => {
    const res = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reference: '',
        saleDate: '2026-11-11',
        items: [{ productId, sourceAreaId: area1Id, quantity: 500 }], // only 125 available
        isDraft: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Insufficient available stock');

    const prodRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(prodRes.body.data.totalAvailable).toBe(125);
  });
});

