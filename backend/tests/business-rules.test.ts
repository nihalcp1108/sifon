import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AreaService } from '../src/modules/areas/area.service.js';
import { ProductService } from '../src/modules/products/product.service.js';
import { InventoryMovement } from '../src/modules/inventory/inventory-movement.model.js';
import { InventoryBalance } from '../src/modules/inventory/inventory-balance.model.js';

describe('Inventory Business Rules & Concurrency Tests', () => {
  let app: any;
  let adminToken: string;
  let area3Id: string;
  let testProdId: string;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();

    await AuthService.createAdminIfNotExists(
      'admin@sifon.local',
      'Admin@Sifon2026!',
      'Admin'
    );

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sifon.local', password: 'Admin@Sifon2026!' });
    adminToken = loginRes.body.data.token;

    const area3 = await AreaService.createArea({ areaNumber: 3, description: 'Concurrency Area' });
    area3Id = area3._id.toString();

    const prod = await ProductService.createProduct(
      {
        code: 'CONCUR-01',
        name: 'Concurrency Product',
        unit: 'pcs',
        openingStock: [{ areaId: area3Id, quantity: 100 }],
      },
      loginRes.body.data.user.id
    );
    testProdId = prod._id.toString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('Concurrent sales cannot oversell stock beyond available balance', async () => {
    // Current stock is 100. Let 4 concurrent requests each try to sell 40 units (total 160 requested).
    // Exactly 2 requests must succeed (80 sold, 20 left) and 2 must fail!
    const sellPromises = Array.from({ length: 4 }).map((_, idx) =>
      request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reference: `SAL-CONCUR-${idx + 1}`,
          saleDate: '2026-11-06',
          items: [{ productId: testProdId, sourceAreaId: area3Id, quantity: 40 }],
        })
    );

    const responses = await Promise.all(sellPromises);
    const successCount = responses.filter(r => r.status === 201).length;
    const failCount = responses.filter(r => r.status === 400).length;

    expect(successCount).toBe(2);
    expect(failCount).toBe(2);

    // Remaining balance must be exactly 20
    const prodRes = await request(app)
      .get(`/api/v1/products/${testProdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.body.data.totalAvailable).toBe(20);
  });

  it('Sale reversal is blocked when active returns exist against it', async () => {
    // Create a new sale of 20 units
    const saleRes = await request(app)
      .post('/api/v1/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        saleDate: '2026-11-06',
        items: [{ productId: testProdId, sourceAreaId: area3Id, quantity: 20 }],
      });
    expect(saleRes.status).toBe(201);
    const saleId = saleRes.body.data._id;
    const saleLineId = saleRes.body.data.items[0]._id;

    // Return 5 units against it
    const retRes = await request(app)
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        returnDate: '2026-11-06',
        saleId,
        saleLineId,
        receivingAreaId: area3Id,
        nonDamagedQuantity: 5,
        damagedQuantity: 0,
        reason: 'Customer return before reversal check',
      });
    expect(retRes.status).toBe(201);
    const returnId = retRes.body.data._id;

    // Attempt to cancel the sale while active return exists -> MUST FAIL!
    const cancelSaleRes = await request(app)
      .post(`/api/v1/sales/${saleId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Attempt cancel with active return' });

    expect(cancelSaleRes.status).toBe(400);
    expect(cancelSaleRes.body.message).toContain('Reverse the associated returns first');

    // Now reverse the return
    const cancelReturnRes = await request(app)
      .post(`/api/v1/returns/${returnId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Reversing return first' });
    expect(cancelReturnRes.status).toBe(200);

    // Now cancel the sale -> MUST SUCCEED!
    const successfulSaleCancel = await request(app)
      .post(`/api/v1/sales/${saleId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Returns are cleared now' });
    expect(successfulSaleCancel.status).toBe(200);
    expect(successfulSaleCancel.body.data.status).toBe('CANCELLED');
  });

  it('Prevent Area deactivation while stock remains', async () => {
    // Area 3 has remaining stock
    const deactivateRes = await request(app)
      .put(`/api/v1/areas/${area3Id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(deactivateRes.status).toBe(400);
    expect(deactivateRes.body.message).toContain('Cannot deactivate Area 3 while available or damaged stock remains');
  });

  it('Prevent Area deletion when historical transactions exist', async () => {
    const deleteRes = await request(app)
      .delete(`/api/v1/areas/${area3Id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.message).toContain('Cannot delete Area 3 because it has historical inventory transactions');
  });

  it('Reconciliation check: ledger sums match materialized balances', async () => {
    const ledgerTotals = await InventoryMovement.aggregate([
      {
        $group: {
          _id: { productId: '$productId', areaId: '$areaId' },
          totalAvailable: { $sum: '$availableDelta' },
          totalDamaged: { $sum: '$damagedDelta' },
        },
      },
    ]);

    for (const item of ledgerTotals) {
      const balance = await InventoryBalance.findOne({
        productId: item._id.productId,
        areaId: item._id.areaId,
      });
      expect(balance).toBeDefined();
      expect(balance!.availableQuantity).toBe(item.totalAvailable);
      expect(balance!.damagedQuantity).toBe(item.totalDamaged);
    }
  });
});

