import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { InventoryBalance } from '../src/modules/inventory/inventory-balance.model.js';
import { InventoryMovement } from '../src/modules/inventory/inventory-movement.model.js';
import { Product } from '../src/modules/products/product.model.js';
import { Area } from '../src/modules/areas/area.model.js';

interface Discrepancy {
  productCode: string;
  productName: string;
  areaNumber: number;
  materializedAvailable: number;
  ledgerAvailable: number;
  availableDifference: number;
  materializedDamaged: number;
  ledgerDamaged: number;
  damagedDifference: number;
}

async function reconcile(): Promise<void> {
  console.log('====================================================');
  console.log('  SIFON INVENTORY RECONCILIATION AUDIT (READ-ONLY)  ');
  console.log('====================================================\n');

  try {
    await connectDatabase();

    // 1. Calculate sum of movements from ledger
    const ledgerTotals = await InventoryMovement.aggregate([
      {
        $group: {
          _id: { productId: '$productId', areaId: '$areaId' },
          ledgerAvailable: { $sum: '$availableDelta' },
          ledgerDamaged: { $sum: '$damagedDelta' },
          movementCount: { $sum: 1 },
        },
      },
    ]);

    const ledgerMap = new Map<string, { available: number; damaged: number; count: number }>();
    for (const item of ledgerTotals) {
      const key = `${item._id.productId.toString()}_${item._id.areaId.toString()}`;
      ledgerMap.set(key, {
        available: item.ledgerAvailable || 0,
        damaged: item.ledgerDamaged || 0,
        count: item.movementCount || 0,
      });
    }

    // 2. Fetch all materialized balances
    const balances = await InventoryBalance.find()
      .populate('productId', 'code name')
      .populate('areaId', 'areaNumber')
      .lean();

    const checkedKeys = new Set<string>();
    const discrepancies: Discrepancy[] = [];
    let matchCount = 0;

    for (const bal of balances) {
      const pId = bal.productId ? (bal.productId as any)._id?.toString() || (bal.productId as any).toString() : '';
      const aId = bal.areaId ? (bal.areaId as any)._id?.toString() || (bal.areaId as any).toString() : '';
      const key = `${pId}_${aId}`;
      checkedKeys.add(key);

      const ledger = ledgerMap.get(key) || { available: 0, damaged: 0, count: 0 };
      const availDiff = bal.availableQuantity - ledger.available;
      const dmgDiff = bal.damagedQuantity - ledger.damaged;

      if (availDiff !== 0 || dmgDiff !== 0) {
        discrepancies.push({
          productCode: (bal.productId as any)?.code || 'UNKNOWN',
          productName: (bal.productId as any)?.name || 'UNKNOWN',
          areaNumber: (bal.areaId as any)?.areaNumber || 0,
          materializedAvailable: bal.availableQuantity,
          ledgerAvailable: ledger.available,
          availableDifference: availDiff,
          materializedDamaged: bal.damagedQuantity,
          ledgerDamaged: ledger.damaged,
          damagedDifference: dmgDiff,
        });
      } else {
        matchCount++;
      }
    }

    // 3. Check for any movements that exist in ledger but have no balance record
    for (const [key, ledger] of ledgerMap.entries()) {
      if (!checkedKeys.has(key)) {
        const [pId, aId] = key.split('_');
        const prod = await Product.findById(pId).lean();
        const area = await Area.findById(aId).lean();

        if (ledger.available !== 0 || ledger.damaged !== 0) {
          discrepancies.push({
            productCode: prod?.code || 'UNKNOWN',
            productName: prod?.name || 'UNKNOWN',
            areaNumber: area?.areaNumber || 0,
            materializedAvailable: 0,
            ledgerAvailable: ledger.available,
            availableDifference: -ledger.available,
            materializedDamaged: 0,
            ledgerDamaged: ledger.damaged,
            damagedDifference: -ledger.damaged,
          });
        }
      }
    }

    console.log(`Audited ${checkedKeys.size} product-area balance records.`);
    console.log(`Matching records: ${matchCount}`);

    if (discrepancies.length === 0) {
      console.log('\n[PASS] Perfect reconciliation: Materialized balances exactly match ledger totals 100%!');
    } else {
      console.error(`\n[ALERT] Found ${discrepancies.length} discrepancy record(s):`);
      console.table(discrepancies);
      console.warn('NOTE: As per requirement, this script is read-only and does not automatically rewrite inventory.');
    }
  } catch (error) {
    console.error('Reconciliation error:', error);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

reconcile();

