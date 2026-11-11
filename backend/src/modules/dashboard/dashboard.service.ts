import { Product } from '../products/product.model.js';
import { Area } from '../areas/area.model.js';
import { InventoryBalance } from '../inventory/inventory-balance.model.js';
import { Purchase } from '../purchases/purchase.model.js';
import { Sale } from '../sales/sale.model.js';
import { Return } from '../returns/return.model.js';
import { InventoryMovement } from '../inventory/inventory-movement.model.js';
import { nowInTimezone } from '../../utils/date.js';

export class DashboardService {
  static async getSummary() {
    const today = nowInTimezone();
    const todayStartUtc = today.startOf('day').toJSDate();
    const todayEndUtc = today.plus({ days: 1 }).startOf('day').toJSDate();

    // 1. Active product count
    const activeProductCount = await Product.countDocuments({ isActive: true });

    // 2. Active area count
    const activeAreaCount = await Area.countDocuments({ isActive: true });

    // 3. Stock balances (available & damaged totals)
    const stockAgg = await InventoryBalance.aggregate([
      {
        $group: {
          _id: null,
          totalAvailable: { $sum: '$availableQuantity' },
          totalDamaged: { $sum: '$damagedQuantity' },
        },
      },
    ]);

    const totalAvailableQuantity = stockAgg[0]?.totalAvailable || 0;
    const totalDamagedQuantity = stockAgg[0]?.totalDamaged || 0;

    // 4. Today's purchased quantity
    const todayPurchasesAgg = await InventoryMovement.aggregate([
      {
        $match: {
          movementType: 'PURCHASE',
          businessDate: { $gte: todayStartUtc, $lt: todayEndUtc },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$availableDelta' },
        },
      },
    ]);
    const todayPurchasedQuantity = todayPurchasesAgg[0]?.total || 0;

    // 5. Today's sold quantity
    const todaySalesAgg = await InventoryMovement.aggregate([
      {
        $match: {
          movementType: 'SALE',
          businessDate: { $gte: todayStartUtc, $lt: todayEndUtc },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $abs: '$availableDelta' } },
        },
      },
    ]);
    const todaySoldQuantity = todaySalesAgg[0]?.total || 0;

    // 6. Recent purchases (latest 5)
    const recentPurchases = await Purchase.find()
      .populate('items.productId', 'code name unit')
      .populate('items.receivingAreaId', 'areaNumber description')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 7. Recent sales (latest 5)
    const recentSales = await Sale.find()
      .populate('items.productId', 'code name unit')
      .populate('items.sourceAreaId', 'areaNumber description')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // 8. Recent returns (latest 5)
    const recentReturns = await Return.find()
      .populate('productId', 'code name unit')
      .populate('receivingAreaId', 'areaNumber description')
      .populate('saleId', 'reference')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      activeProductCount,
      activeAreaCount,
      totalAvailableQuantity,
      totalDamagedQuantity,
      todayPurchasedQuantity,
      todaySoldQuantity,
      recentPurchases,
      recentSales,
      recentReturns,
    };
  }
}

