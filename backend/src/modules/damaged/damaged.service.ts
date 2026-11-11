import mongoose from 'mongoose';
import { InventoryBalance } from '../inventory/inventory-balance.model.js';
import { Return } from '../returns/return.model.js';
import { parseDateStartInclusive, parseDateEndExclusive } from '../../utils/date.js';

export interface DamagedFilterInput {
  productId?: string;
  areaId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class DamagedService {
  /**
   * Get current damaged inventory balances by product and area (damagedQuantity > 0)
   */
  static async getDamagedBalances(filter: DamagedFilterInput) {
    const query: Record<string, any> = {
      damagedQuantity: { $gt: 0 },
    };

    if (filter.productId) {
      query.productId = new mongoose.Types.ObjectId(filter.productId);
    }
    if (filter.areaId) {
      query.areaId = new mongoose.Types.ObjectId(filter.areaId);
    }

    const balances = await InventoryBalance.find(query)
      .populate('productId', 'code name unit')
      .populate('areaId', 'areaNumber description')
      .lean();

    balances.sort((a: any, b: any) => {
      const numA = a.areaId?.areaNumber ?? 999999;
      const numB = b.areaId?.areaNumber ?? 999999;
      return numA - numB;
    });

    const totalDamagedQuantity = balances.reduce((sum, b) => sum + (b.damagedQuantity || 0), 0);

    return {
      balances,
      totalDamagedQuantity,
    };
  }

  /**
   * Get supporting return history that created or affected damaged inventory
   */
  static async getDamagedHistory(filter: DamagedFilterInput) {
    const query: Record<string, any> = {
      damagedQuantity: { $gt: 0 },
    };

    if (filter.productId) {
      query.productId = new mongoose.Types.ObjectId(filter.productId);
    }
    if (filter.areaId) {
      query.receivingAreaId = new mongoose.Types.ObjectId(filter.areaId);
    }
    if (filter.startDate || filter.endDate) {
      query.returnDate = {};
      if (filter.startDate) {
        query.returnDate.$gte = parseDateStartInclusive(filter.startDate);
      }
      if (filter.endDate) {
        query.returnDate.$lt = parseDateEndExclusive(filter.endDate);
      }
    }

    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const total = await Return.countDocuments(query);

    const returns = await Return.find(query)
      .populate('productId', 'code name unit')
      .populate('receivingAreaId', 'areaNumber description')
      .populate('saleId', 'reference saleDate')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .sort({ returnDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      history: returns,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

