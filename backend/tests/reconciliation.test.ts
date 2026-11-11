import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb, clearTestDb } from './setup.js';
import { AreaService } from '../src/modules/areas/area.service.js';
import { ProductService } from '../src/modules/products/product.service.js';
import { PurchaseService } from '../src/modules/purchases/purchase.service.js';
import { SaleService } from '../src/modules/sales/sale.service.js';
import { ReturnService } from '../src/modules/returns/return.service.js';
import { InventoryBalance } from '../src/modules/inventory/inventory-balance.model.js';
import { InventoryMovement } from '../src/modules/inventory/inventory-movement.model.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

describe('Inventory Reconciliation Integrity Tests', () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
    const admin = await AuthService.createAdminIfNotExists(
      'reconcile-admin@sifon.local',
      'Admin@Sifon2026!',
      'Reconciliation Admin'
    );
    userId = admin._id.toString();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('Materialized balances perfectly match ledger aggregates after multiple lifecycle operations', async () => {
    // 1. Create Area 10
    const area = await AreaService.createArea({ areaNumber: 10, description: 'Reconciliation Area' });

    // 2. Create Product with Opening Stock
    const prod = await ProductService.createProduct(
      {
        code: 'RECON-SKU-01',
        name: 'Reconciliation Valve',
        unit: 'pcs',
        openingStock: [{ areaId: area._id.toString(), quantity: 200 }],
      },
      userId
    );

    // 3. Purchase 100 units
    const pur = await PurchaseService.createPurchase(
      {
        purchaseDate: '2026-11-06',
        items: [{ productId: prod._id.toString(), receivingAreaId: area._id.toString(), quantity: 100 }],
      },
      userId
    );

    // 4. Sell 60 units
    const sale = await SaleService.createSale(
      {
        saleDate: '2026-11-06',
        items: [{ productId: prod._id.toString(), sourceAreaId: area._id.toString(), quantity: 60 }],
      },
      userId
    );

    // 5. Return 10 units (7 non-damaged, 3 damaged)
    const ret = await ReturnService.createReturn(
      {
        returnDate: '2026-11-06',
        saleId: sale._id.toString(),
        saleLineId: sale.items[0]._id.toString(),
        receivingAreaId: area._id.toString(),
        nonDamagedQuantity: 7,
        damagedQuantity: 3,
        reason: 'Partial return during audit',
      },
      userId
    );

    // Expected Available: 200 (opening) + 100 (pur) - 60 (sale) + 7 (ret) = 247
    // Expected Damaged: 3

    // Aggregate from immutable ledger movements
    const ledgerAgg = await InventoryMovement.aggregate([
      {
        $match: {
          productId: prod._id,
          areaId: area._id,
        },
      },
      {
        $group: {
          _id: null,
          totalAvailable: { $sum: '$availableDelta' },
          totalDamaged: { $sum: '$damagedDelta' },
        },
      },
    ]);

    expect(ledgerAgg[0].totalAvailable).toBe(247);
    expect(ledgerAgg[0].totalDamaged).toBe(3);

    // Read materialized balance
    const balance = await InventoryBalance.findOne({
      productId: prod._id,
      areaId: area._id,
    });

    expect(balance).toBeDefined();
    expect(balance!.availableQuantity).toBe(247);
    expect(balance!.damagedQuantity).toBe(3);

    // Discrepancy check: exactly 0
    expect(balance!.availableQuantity - ledgerAgg[0].totalAvailable).toBe(0);
    expect(balance!.damagedQuantity - ledgerAgg[0].totalDamaged).toBe(0);
  });
});

