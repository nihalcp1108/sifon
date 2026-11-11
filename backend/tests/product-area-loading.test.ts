import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setupTestDb, teardownTestDb } from './setup.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ProductService } from '../src/modules/products/product.service.js';
import { AreaService } from '../src/modules/areas/area.service.js';
import { PurchaseService } from '../src/modules/purchases/purchase.service.js';
import { SaleService } from '../src/modules/sales/sale.service.js';

describe('Product and Area Loading Regression Suite', () => {
  let app: any;
  let adminToken: string;
  let adminId: string;
  let zeroStockProdId: string;
  let area1Id: string;
  let area2Id: string;
  let area10Id: string;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();

    const admin = await AuthService.createAdminIfNotExists(
      'admin@sifon.local',
      'Admin@Sifon2026!',
      'Admin User'
    );
    adminId = admin._id.toString();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sifon.local', password: 'Admin@Sifon2026!' });

    adminToken = loginRes.body.data.token;

    // Create Areas out of order: Area 10, Area 1, Area 2
    const a10 = await AreaService.createArea({ areaNumber: 10, description: 'High Area 10' });
    const a1 = await AreaService.createArea({ areaNumber: 1, description: 'First Area' });
    const a2 = await AreaService.createArea({ areaNumber: 2, description: 'Second Area' });
    area10Id = a10._id.toString();
    area1Id = a1._id.toString();
    area2Id = a2._id.toString();

    // Create a product with zero initial stock
    const p1 = await ProductService.createProduct(
      {
        code: 'ZERO-SKU-001',
        name: 'Zero Stock Test Product',
        unit: 'pcs',
      },
      adminId
    );
    zeroStockProdId = p1._id.toString();

    // Create another product
    await ProductService.createProduct(
      {
        code: 'WIDGET-ABC-999',
        name: 'Searchable Widget ABC',
        unit: 'boxes',
      },
      adminId
    );
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('1. Accepts previously rejected queries on GET /api/v1/products and returns 200', async () => {
    // Exact queries from Purchase / Sale forms
    const res500 = await request(app)
      .get('/api/v1/products?activeOnly=true&limit=500')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res500.status).toBe(200);
    expect(res500.body.success).toBe(true);
    expect(res500.body.data.length).toBeGreaterThanOrEqual(2);

    // Boolean true passed as query param (e.g. ?activeOnly=1 or ?activeOnly=true)
    const res1 = await request(app)
      .get('/api/v1/products?activeOnly=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res1.status).toBe(200);

    // Empty string or 'all' does not trigger 422
    const resEmpty = await request(app)
      .get('/api/v1/products?activeOnly=&search=')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resEmpty.status).toBe(200);

    // isActive alias works
    const resIsActive = await request(app)
      .get('/api/v1/products?isActive=true')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resIsActive.status).toBe(200);
  });

  it('2. Accepts previously rejected queries on GET /api/v1/areas and returns 200', async () => {
    // Exact query from Purchase / Sale forms
    const res200 = await request(app)
      .get('/api/v1/areas?activeOnly=true&limit=200')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res200.status).toBe(200);
    expect(res200.body.success).toBe(true);
    expect(res200.body.data.length).toBe(3);

    // Numeric sort check: Area 1, Area 2, Area 10 (not alphabetical 1, 10, 2)
    const numbers = res200.body.data.map((a: any) => a.areaNumber);
    expect(numbers).toEqual([1, 2, 10]);
  });

  it('3. Dedicated GET /api/v1/products/options endpoint provides lightweight options with balances', async () => {
    const res = await request(app)
      .get('/api/v1/products/options?limit=50')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const zeroProd = res.body.data.find((p: any) => p._id === zeroStockProdId);
    expect(zeroProd).toBeDefined();
    expect(zeroProd.totalAvailable).toBe(0);
    expect(zeroProd.code).toBe('ZERO-SKU-001');
  });

  it('4. Dedicated GET /api/v1/areas/options endpoint sorts areas strictly in natural numeric order', async () => {
    const res = await request(app)
      .get('/api/v1/areas/options')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const areas = res.body.data;
    expect(areas[0].areaNumber).toBe(1);
    expect(areas[0].displayName).toBe('Area 1');
    expect(areas[1].areaNumber).toBe(2);
    expect(areas[1].displayName).toBe('Area 2');
    expect(areas[2].areaNumber).toBe(10);
    expect(areas[2].displayName).toBe('Area 10');
  });

  it('5. Unsupported / invalid query values return structured 422 validation errors without crashing', async () => {
    const invalidLimit = await request(app)
      .get('/api/v1/products?limit=0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidLimit.status).toBe(422);
    expect(invalidLimit.body.message).toMatch(/Invalid request parameters/i);

    const exceedLimit = await request(app)
      .get('/api/v1/products?limit=1001')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(exceedLimit.status).toBe(422);

    const invalidPage = await request(app)
      .get('/api/v1/areas?page=abc')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidPage.status).toBe(422);

    const invalidBool = await request(app)
      .get('/api/v1/areas?activeOnly=notabool')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(invalidBool.status).toBe(422);
  });

  it('6. Server search finds products matching code or name across pages', async () => {
    const res = await request(app)
      .get('/api/v1/products/options?search=WIDGET')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].code).toBe('WIDGET-ABC-999');
  });

  it('7. Option selection preservation: selectedId is always included even when limited to 1 result', async () => {
    const res = await request(app)
      .get(`/api/v1/products/options?limit=1&selectedId=${zeroStockProdId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const hasZeroStock = res.body.data.some((p: any) => p._id === zeroStockProdId);
    expect(hasZeroStock).toBe(true);
  });

  it('8. Zero-stock product can be purchased into an area with no existing balance', async () => {
    // Area 10 currently has no balance record for zeroStockProdId
    const purchase = await PurchaseService.createPurchase(
      {
        purchaseDate: '2026-11-10',
        items: [
          {
            productId: zeroStockProdId,
            receivingAreaId: area10Id,
            quantity: 35,
          },
        ],
        isDraft: false,
      },
      adminId
    );

    expect(purchase.status).toBe('POSTED');

    // Confirm that options now reflect 35 available units in Area 10
    const optsRes = await request(app)
      .get(`/api/v1/products/options?search=ZERO-SKU`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(optsRes.status).toBe(200);
    const prodOpt = optsRes.body.data[0];
    expect(prodOpt.totalAvailable).toBe(35);
    const a10Bal = prodOpt.areaBalances.find((b: any) => (b.areaId?._id || b.areaId).toString() === area10Id);
    expect(a10Bal).toBeDefined();
    expect(a10Bal.availableQuantity).toBe(35);
  });

  it('9. Static lookup routes /options and /active reach lookup handlers, NOT dynamic /:id', async () => {
    // Products: /options and /active must both return 200 and an array, never hit findById('options'/'active')
    const prodOptRes = await request(app)
      .get('/api/v1/products/options')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodOptRes.status).toBe(200);
    expect(Array.isArray(prodOptRes.body.data)).toBe(true);
    expect(prodOptRes.body.data.length).toBeGreaterThan(0);

    const prodActiveRes = await request(app)
      .get('/api/v1/products/active')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodActiveRes.status).toBe(200);
    expect(Array.isArray(prodActiveRes.body.data)).toBe(true);

    // Areas: /options and /active must both return 200 and an array, never hit findById('options'/'active')
    const areaOptRes = await request(app)
      .get('/api/v1/areas/options')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(areaOptRes.status).toBe(200);
    expect(Array.isArray(areaOptRes.body.data)).toBe(true);
    expect(areaOptRes.body.data.length).toBe(3);

    const areaActiveRes = await request(app)
      .get('/api/v1/areas/active')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(areaActiveRes.status).toBe(200);
    expect(Array.isArray(areaActiveRes.body.data)).toBe(true);
  });

  it('10. Valid 24-character hex ObjectIds work on dynamic /:id detail routes', async () => {
    const prodRes = await request(app)
      .get(`/api/v1/products/${zeroStockProdId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(prodRes.status).toBe(200);
    expect(prodRes.body.success).toBe(true);
    expect(prodRes.body.data._id).toBe(zeroStockProdId);
    expect(prodRes.body.data.code).toBe('ZERO-SKU-001');

    const areaRes = await request(app)
      .get(`/api/v1/areas/${area1Id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(areaRes.status).toBe(200);
    expect(areaRes.body.success).toBe(true);
    expect(areaRes.body.data._id).toBe(area1Id);
    expect(areaRes.body.data.areaNumber).toBe(1);
  });

  it('11. Non-ObjectId values on dynamic /:id routes are rejected with 422 validation errors', async () => {
    // Invalid ID string 'invalid-id' should fail validation without triggering unhandled database CastErrors
    const badProdRes = await request(app)
      .get('/api/v1/products/invalid-id-xyz')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(badProdRes.status).toBe(422);
    expect(badProdRes.body.success).toBe(false);
    expect(badProdRes.body.message).toMatch(/Invalid request parameters|Validation failed/i);
    expect(badProdRes.body.error.details.some((d: any) => d.path === 'id')).toBe(true);

    const undefProdRes = await request(app)
      .get('/api/v1/products/undefined')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(undefProdRes.status).toBe(422);

    const badAreaRes = await request(app)
      .get('/api/v1/areas/invalid-id-xyz')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(badAreaRes.status).toBe(422);
    expect(badAreaRes.body.success).toBe(false);

    const undefAreaRes = await request(app)
      .get('/api/v1/areas/undefined')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(undefAreaRes.status).toBe(422);
  });

  it('12. End-to-End Verification Scenario: Test product & Area 1 -> Purchase 20 -> Sale 5 -> Available 15 -> Selectors verify', async () => {
    // 1. Create a test product
    const e2eProd = await ProductService.createProduct(
      {
        code: 'E2E-ITEM-100',
        name: 'End-to-End Flow Item',
        unit: 'pcs',
      },
      adminId
    );
    const e2eProdId = e2eProd._id.toString();

    // 2. Selectors before purchase: both area and product are selectable, product has 0 stock
    const pOptsBefore = await request(app)
      .get('/api/v1/products/options?search=E2E-ITEM')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pOptsBefore.status).toBe(200);
    expect(pOptsBefore.body.data[0].totalAvailable).toBe(0);

    const aOpts = await request(app)
      .get('/api/v1/areas/options')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(aOpts.status).toBe(200);
    const area1Entry = aOpts.body.data.find((a: any) => a._id === area1Id);
    expect(area1Entry).toBeDefined();

    // 3. Post a purchase of 20 units into Area 1
    const purchase = await PurchaseService.createPurchase(
      {
        purchaseDate: '2026-11-10',
        items: [{ productId: e2eProdId, receivingAreaId: area1Id, quantity: 20 }],
        isDraft: false,
      },
      adminId
    );
    expect(purchase.status).toBe('POSTED');

    // 4 & 5. Open Add Sale and verify available stock in Area 1 is 20
    const pOptsAfterPur = await request(app)
      .get('/api/v1/products/options?search=E2E-ITEM')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pOptsAfterPur.status).toBe(200);
    const prodAfterPur = pOptsAfterPur.body.data[0];
    expect(prodAfterPur.totalAvailable).toBe(20);
    const a1Bal = prodAfterPur.areaBalances.find(
      (b: any) => (b.areaId?._id || b.areaId).toString() === area1Id
    );
    expect(a1Bal.availableQuantity).toBe(20);

    // 6. Post a sale of 5 units from Area 1
    const sale = await SaleService.createSale(
      {
        saleDate: '2026-11-10',
        items: [{ productId: e2eProdId, sourceAreaId: area1Id, quantity: 5 }],
        isDraft: false,
      },
      adminId
    );
    expect(sale.status).toBe('POSTED');

    // 7. Confirm available stock is now 15
    const pOptsAfterSale = await request(app)
      .get('/api/v1/products/options?search=E2E-ITEM')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pOptsAfterSale.status).toBe(200);
    const prodAfterSale = pOptsAfterSale.body.data[0];
    expect(prodAfterSale.totalAvailable).toBe(15);
    const a1BalAfter = prodAfterSale.areaBalances.find(
      (b: any) => (b.areaId?._id || b.areaId).toString() === area1Id
    );
    expect(a1BalAfter.availableQuantity).toBe(15);

    // 8 & 9. Reload both screen options and confirm selectors still return 200 OK without errors
    const reloadProd = await request(app)
      .get('/api/v1/products/options?activeOnly=true&limit=200')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reloadProd.status).toBe(200);
    expect(reloadProd.body.success).toBe(true);

    const reloadArea = await request(app)
      .get('/api/v1/areas/options?activeOnly=true&limit=100')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reloadArea.status).toBe(200);
    expect(reloadArea.body.success).toBe(true);
  });

  it('13. Robust Error Handling: Malformed JSON body returns 400 (not 500) and invalid login returns 401 (not 500)', async () => {
    // Malformed JSON returns 400
    const badJson = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('invalid-raw-json-payload');
    expect(badJson.status).toBe(400);
    expect(badJson.body.success).toBe(false);
    expect(badJson.body.message).toMatch(/Malformed JSON/i);

    // Invalid login credentials returns 401
    const badLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@sifon.local', password: 'IncorrectPassword123!' });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.success).toBe(false);
    expect(badLogin.body.message).toMatch(/Invalid email or password/i);

    // Unauthenticated /auth/me returns 401
    const unauthMe = await request(app).get('/api/v1/auth/me');
    expect(unauthMe.status).toBe(401);
    expect(unauthMe.body.message).toMatch(/Authentication required/i);
  });
});

