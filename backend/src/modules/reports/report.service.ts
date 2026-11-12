import mongoose from 'mongoose';
import { Product } from '../products/product.model.js';
import { Area } from '../areas/area.model.js';
import { InventoryBalance } from '../inventory/inventory-balance.model.js';
import { InventoryMovement } from '../inventory/inventory-movement.model.js';
import { MatrixStatementQueryInput, PeriodStatementQueryInput } from './report.validation.js';
import { parseDateStartInclusive, parseDateEndExclusive } from '../../utils/date.js';
import { arrayToCsv } from '../../utils/csv.js';

function formatAreaDisplayName(area: any): string {
  if (area.sectionId && typeof area.sectionId === 'object' && area.sectionId.name && area.name) {
    return `${area.sectionId.name} — ${area.name}`;
  }
  if (area.name) return area.name;
  if (area.areaNumber) return `Area ${area.areaNumber}`;
  return 'Unnamed Area';
}

export class ReportService {
  /**
   * View A: Current Area-Wise Stock Matrix
   */
  static async getCurrentStockMatrix(query: MatrixStatementQueryInput) {
    const productFilter: Record<string, any> = {};
    if (query.productId) {
      productFilter._id = new mongoose.Types.ObjectId(query.productId);
    }
    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      productFilter.$or = [{ name: regex }, { code: regex }];
    }

    const areaFilter: Record<string, any> = {};
    if (query.areaId) {
      areaFilter._id = new mongoose.Types.ObjectId(query.areaId);
    }

    // Get all areas populated with section
    const areas = await Area.find(areaFilter)
      .populate('sectionId', 'name')
      .sort({ areaNumber: 1, name: 1 })
      .lean();

    const products = await Product.find(productFilter)
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean();

    const productIds = products.map(p => p._id);
    const areaIds = areas.map(a => a._id);

    // Fetch balances
    const balances = await InventoryBalance.find({
      productId: { $in: productIds },
      areaId: { $in: areaIds },
    }).lean();

    // Map balances by `${productId}_${areaId}`
    const balanceMap = new Map<string, { available: number; damaged: number }>();
    for (const b of balances) {
      balanceMap.set(`${b.productId.toString()}_${b.areaId.toString()}`, {
        available: b.availableQuantity || 0,
        damaged: b.damagedQuantity || 0,
      });
    }

    // Build matrix rows
    const rows = products.map(product => {
      const pIdStr = product._id.toString();
      let totalAvailable = 0;
      let totalDamaged = 0;

      const areaQuantities: Record<string, { available: number; damaged: number }> = {};

      for (const area of areas) {
        const aIdStr = area._id.toString();
        const bal = balanceMap.get(`${pIdStr}_${aIdStr}`) || { available: 0, damaged: 0 };
        areaQuantities[aIdStr] = bal;
        totalAvailable += bal.available;
        totalDamaged += bal.damaged;
      }

      return {
        product: {
          _id: product._id,
          name: product.name,
          unit: product.unit,
          isActive: product.isActive,
          brand: (product as any).brandId ? { _id: (product as any).brandId._id, name: (product as any).brandId.name } : undefined,
          category: (product as any).categoryId ? { _id: (product as any).categoryId._id, name: (product as any).categoryId.name } : undefined,
        },
        areaQuantities,
        totalAvailable,
        totalDamaged,
      };
    });

    return {
      areas: areas.map(a => ({
        _id: a._id,
        areaNumber: a.areaNumber,
        name: a.name,
        section: (a as any).sectionId ? { _id: (a as any).sectionId._id, name: (a as any).sectionId.name } : undefined,
        displayName: formatAreaDisplayName(a),
        description: a.description,
        isActive: a.isActive,
      })),
      rows,
    };
  }

  /**
   * Export View A to CSV
   */
  static async exportStockMatrixCsv(query: MatrixStatementQueryInput): Promise<string> {
    const data = await this.getCurrentStockMatrix(query);

    const headers = [
      'Brand',
      'Category',
      'Product Name',
      'Unit',
      'Status',
      ...data.areas.map(a => `${a.displayName} (Available)`),
      ...data.areas.map(a => `${a.displayName} (Damaged)`),
      'Total Available',
      'Total Damaged',
    ];

    const rows = data.rows.map(row => {
      const availableByArea = data.areas.map(a => row.areaQuantities[a._id.toString()]?.available || 0);
      const damagedByArea = data.areas.map(a => row.areaQuantities[a._id.toString()]?.damaged || 0);

      return [
        row.product.brand?.name || '—',
        row.product.category?.name || '—',
        row.product.name,
        row.product.unit,
        row.product.isActive ? 'Active' : 'Archived',
        ...availableByArea,
        ...damagedByArea,
        row.totalAvailable,
        row.totalDamaged,
      ];
    });

    return arrayToCsv(headers, rows);
  }

  /**
   * View B: Period Stock Movement Statement
   */
  static async getPeriodMovementStatement(query: PeriodStatementQueryInput) {
    const startUtc = parseDateStartInclusive(query.startDate);
    const endUtc = parseDateEndExclusive(query.endDate);

    const productFilter: Record<string, any> = {};
    if (query.productId) {
      productFilter._id = new mongoose.Types.ObjectId(query.productId);
    }
    if (query.search) {
      const regex = new RegExp(query.search.trim(), 'i');
      productFilter.$or = [{ name: regex }, { code: regex }];
    }

    const areaFilter: Record<string, any> = {};
    if (query.areaId) {
      areaFilter._id = new mongoose.Types.ObjectId(query.areaId);
    }

    const areas = await Area.find(areaFilter)
      .populate('sectionId', 'name')
      .sort({ areaNumber: 1, name: 1 })
      .lean();
    const products = await Product.find(productFilter)
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean();

    const productIds = products.map(p => p._id);
    const areaIds = areas.map(a => a._id);

    // Calculate opening balances: sum of movements strictly before startUtc
    const openingMovements = await InventoryMovement.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          areaId: { $in: areaIds },
          businessDate: { $lt: startUtc },
        },
      },
      {
        $group: {
          _id: { productId: '$productId', areaId: '$areaId' },
          openingAvailable: { $sum: '$availableDelta' },
          openingDamaged: { $sum: '$damagedDelta' },
        },
      },
    ]);

    const openingMap = new Map<string, { available: number; damaged: number }>();
    for (const om of openingMovements) {
      const key = `${om._id.productId.toString()}_${om._id.areaId.toString()}`;
      openingMap.set(key, {
        available: om.openingAvailable || 0,
        damaged: om.openingDamaged || 0,
      });
    }

    // Period movements: between startUtc (inclusive) and endUtc (exclusive)
    const periodMovements = await InventoryMovement.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          areaId: { $in: areaIds },
          businessDate: { $gte: startUtc, $lt: endUtc },
        },
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            areaId: '$areaId',
            movementType: '$movementType',
          },
          totalAvailableDelta: { $sum: '$availableDelta' },
          totalDamagedDelta: { $sum: '$damagedDelta' },
        },
      },
    ]);

    // Group period movements by (productId, areaId)
    const periodMap = new Map<string, Map<string, { available: number; damaged: number }>>();
    for (const pm of periodMovements) {
      const key = `${pm._id.productId.toString()}_${pm._id.areaId.toString()}`;
      if (!periodMap.has(key)) {
        periodMap.set(key, new Map());
      }
      periodMap.get(key)!.set(pm._id.movementType, {
        available: pm.totalAvailableDelta || 0,
        damaged: pm.totalDamagedDelta || 0,
      });
    }

    // Build statement rows for each (product, area) combination
    const statementRows: any[] = [];

    for (const product of products) {
      const pIdStr = product._id.toString();

      for (const area of areas) {
        const aIdStr = area._id.toString();
        const key = `${pIdStr}_${aIdStr}`;

        const opening = openingMap.get(key) || { available: 0, damaged: 0 };
        const moves = periodMap.get(key) || new Map();

        const openingStockAdded = moves.get('OPENING_STOCK')?.available || 0;
        const purchased = moves.get('PURCHASE')?.available || 0;
        const sold = Math.abs(moves.get('SALE')?.available || 0); // express as positive units sold
        const returnedNonDamaged = moves.get('RETURN_AVAILABLE')?.available || 0;

        // Reversal effects
        const purchaseReversals = moves.get('PURCHASE_REVERSAL')?.available || 0; // negative
        const saleReversals = moves.get('SALE_REVERSAL')?.available || 0; // positive
        const returnReversals = moves.get('RETURN_REVERSAL_AVAILABLE')?.available || 0; // negative
        const netAvailableReversals = purchaseReversals + saleReversals + returnReversals;

        // Damaged movements
        const returnedDamaged = moves.get('RETURN_DAMAGED')?.damaged || 0;
        const damagedReversals = moves.get('RETURN_REVERSAL_DAMAGED')?.damaged || 0; // negative
        const netDamagedReversals = damagedReversals;

        // Calculate closing balances
        const closingAvailable =
          opening.available +
          openingStockAdded +
          purchased -
          sold +
          returnedNonDamaged +
          netAvailableReversals;

        const closingDamaged =
          opening.damaged + returnedDamaged + netDamagedReversals;

        // Only include if there is historical or period activity or positive balance
        const hasActivity =
          opening.available !== 0 ||
          opening.damaged !== 0 ||
          closingAvailable !== 0 ||
          closingDamaged !== 0 ||
          purchased !== 0 ||
          sold !== 0 ||
          returnedNonDamaged !== 0 ||
          returnedDamaged !== 0 ||
          netAvailableReversals !== 0;

        if (hasActivity || (query.productId && query.areaId)) {
          statementRows.push({
            product: {
              _id: product._id,
              name: product.name,
              unit: product.unit,
              isActive: product.isActive,
              brand: (product as any).brandId ? { _id: (product as any).brandId._id, name: (product as any).brandId.name } : undefined,
              category: (product as any).categoryId ? { _id: (product as any).categoryId._id, name: (product as any).categoryId.name } : undefined,
            },
            area: {
              _id: area._id,
              areaNumber: area.areaNumber,
              name: area.name,
              section: (area as any).sectionId ? { _id: (area as any).sectionId._id, name: (area as any).sectionId.name } : undefined,
              displayName: formatAreaDisplayName(area),
            },
            openingAvailable: opening.available,
            openingStockAdded,
            purchased,
            sold,
            returnedNonDamaged,
            reversals: {
              purchaseReversals,
              saleReversals,
              returnReversals,
              netAvailableReversals,
            },
            closingAvailable,
            openingDamaged: opening.damaged,
            returnedDamaged,
            damagedReversals: netDamagedReversals,
            closingDamaged,
          });
        }
      }
    }

    return {
      period: {
        startDate: query.startDate,
        endDate: query.endDate,
      },
      rows: statementRows,
    };
  }

  /**
   * Export View B to CSV
   */
  static async exportPeriodStatementCsv(query: PeriodStatementQueryInput): Promise<string> {
    const data = await this.getPeriodMovementStatement(query);

    const headers = [
      'Brand',
      'Category',
      'Product Name',
      'Area',
      'Opening Available',
      'Opening Stock Added',
      'Purchased',
      'Sold',
      'Non-Damaged Returned',
      'Available Reversals',
      'Closing Available',
      'Opening Damaged',
      'Damaged Returned',
      'Damaged Reversals',
      'Closing Damaged',
    ];

    const rows = data.rows.map(row => [
      row.product.brand?.name || '—',
      row.product.category?.name || '—',
      row.product.name,
      row.area.displayName,
      row.openingAvailable,
      row.openingStockAdded,
      row.purchased,
      row.sold,
      row.returnedNonDamaged,
      row.reversals.netAvailableReversals,
      row.closingAvailable,
      row.openingDamaged,
      row.returnedDamaged,
      row.damagedReversals,
      row.closingDamaged,
    ]);

    return arrayToCsv(headers, rows);
  }
}

