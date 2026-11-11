import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { AreaService } from '../src/modules/areas/area.service.js';
import { ProductService } from '../src/modules/products/product.service.js';
import { PurchaseService } from '../src/modules/purchases/purchase.service.js';
import { SaleService } from '../src/modules/sales/sale.service.js';
import { ReturnService } from '../src/modules/returns/return.service.js';
import { env } from '../src/config/env.js';
import { formatBusinessDate, nowInTimezone } from '../src/utils/date.js';

async function seed() {
  if (env.NODE_ENV === 'production') {
    console.error('CRITICAL: Seed script must not be run in production environment!');
    process.exit(1);
  }

  console.log('--- Starting Development Seed ---');
  try {
    await connectDatabase();

    // 1. Create or retrieve admin user
    const admin = await AuthService.createAdminIfNotExists(
      env.INITIAL_ADMIN_EMAIL,
      env.INITIAL_ADMIN_PASSWORD,
      env.INITIAL_ADMIN_NAME
    );
    const userId = admin._id.toString();

    // 2. Create Areas 1, 2, 3 if not existing
    console.log('Seeding Areas 1, 2, 3...');
    let area1, area2, area3;
    try {
      area1 = await AreaService.createArea({ areaNumber: 1, description: 'Main Warehouse - Receiving & Fast Moving' });
    } catch {
      area1 = (await AreaService.getAreas({ activeOnly: 'false' })).areas.find(a => a.areaNumber === 1);
    }

    try {
      area2 = await AreaService.createArea({ areaNumber: 2, description: 'Bulk Storage & Overflow' });
    } catch {
      area2 = (await AreaService.getAreas({ activeOnly: 'false' })).areas.find(a => a.areaNumber === 2);
    }

    try {
      area3 = await AreaService.createArea({ areaNumber: 3, description: 'Inspection & Buffer Zone' });
    } catch {
      area3 = (await AreaService.getAreas({ activeOnly: 'false' })).areas.find(a => a.areaNumber === 3);
    }

    console.log(`Areas ready: Area 1 (${area1!._id}), Area 2 (${area2!._id}), Area 3 (${area3!._id})`);

    // 3. Create Sample Products with opening stocks
    console.log('Seeding Products with opening stocks...');
    let prodValve, prodPump, prodGasket;

    try {
      prodValve = await ProductService.createProduct(
        {
          code: 'VALVE-SS-01',
          name: 'Stainless Steel Ball Valve 2"',
          details: 'High-pressure 1000 WOG female threaded ball valve',
          unit: 'pcs',
          openingStock: [
            { areaId: area1!._id.toString(), quantity: 100 },
            { areaId: area2!._id.toString(), quantity: 50 },
          ],
        },
        userId
      );
    } catch {
      const prods = await ProductService.getProducts({ search: 'VALVE-SS-01' });
      prodValve = prods.products[0];
    }

    try {
      prodPump = await ProductService.createProduct(
        {
          code: 'PUMP-HYD-50',
          name: 'Hydraulic Gear Pump 50cc',
          details: 'Heavy-duty clockwise rotation external gear pump',
          unit: 'units',
          openingStock: [{ areaId: area1!._id.toString(), quantity: 30 }],
        },
        userId
      );
    } catch {
      const prods = await ProductService.getProducts({ search: 'PUMP-HYD-50' });
      prodPump = prods.products[0];
    }

    try {
      prodGasket = await ProductService.createProduct(
        {
          code: 'GSK-EPDM-100',
          name: 'EPDM Flange Gasket 100mm',
          details: 'Full face rubber flange gasket class 150',
          unit: 'pcs',
          openingStock: [{ areaId: area2!._id.toString(), quantity: 200 }],
        },
        userId
      );
    } catch {
      const prods = await ProductService.getProducts({ search: 'GSK-EPDM-100' });
      prodGasket = prods.products[0];
    }

    const todayDateStr = formatBusinessDate(nowInTimezone().toJSDate());

    // 4. Sample Purchase
    console.log('Seeding Sample Purchase into Area 1...');
    const purchase = await PurchaseService.createPurchase(
      {
        reference: 'PUR-SEED-001',
        purchaseDate: todayDateStr,
        notes: 'Initial seed supplier delivery',
        items: [
          {
            productId: prodValve!._id.toString(),
            receivingAreaId: area1!._id.toString(),
            quantity: 50,
          },
          {
            productId: prodPump!._id.toString(),
            receivingAreaId: area1!._id.toString(),
            quantity: 20,
          },
        ],
      },
      userId
    );
    console.log(`Created purchase: ${purchase.reference}`);

    // 5. Sample Sale
    console.log('Seeding Sample Sale from Area 1...');
    const sale = await SaleService.createSale(
      {
        reference: 'SAL-SEED-001',
        saleDate: todayDateStr,
        notes: 'Seed customer order',
        items: [
          {
            productId: prodValve!._id.toString(),
            sourceAreaId: area1!._id.toString(),
            quantity: 40,
          },
        ],
      },
      userId
    );
    console.log(`Created sale: ${sale.reference}`);

    // 6. Sample Returns (both conditions: non-damaged and damaged)
    console.log('Seeding Customer Return (Non-damaged and Damaged)...');
    const saleLine = sale.items[0];

    const returnDoc = await ReturnService.createReturn(
      {
        reference: 'RET-SEED-001',
        returnDate: todayDateStr,
        saleId: sale._id.toString(),
        saleLineId: saleLine._id.toString(),
        receivingAreaId: area1!._id.toString(),
        nonDamagedQuantity: 5,
        damagedQuantity: 3,
        reason: 'Customer ordered wrong spec; 3 damaged during return transit',
      },
      userId
    );
    console.log(`Created customer return: ${returnDoc.reference} (5 non-damaged, 3 damaged)`);

    console.log('\n--- Seed Completed Successfully! ---');
    console.log(`Admin email: ${env.INITIAL_ADMIN_EMAIL}`);
    console.log(`Admin password: ${env.INITIAL_ADMIN_PASSWORD}`);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

seed();

