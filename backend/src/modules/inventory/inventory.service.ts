import mongoose, { ClientSession } from 'mongoose';
import { InventoryBalance, IInventoryBalance } from './inventory-balance.model.js';
import { InventoryMovement, MovementType, SourceDocumentType, IInventoryMovement } from './inventory-movement.model.js';
import { BadRequestError } from '../../utils/errors.js';

export interface AdjustStockParams {
  productId: mongoose.Types.ObjectId | string;
  areaId: mongoose.Types.ObjectId | string;
  availableDelta: number;
  damagedDelta?: number;
  movementType: MovementType;
  sourceDocumentType: SourceDocumentType;
  sourceDocumentId: mongoose.Types.ObjectId | string;
  sourceDocumentLineId?: mongoose.Types.ObjectId | string;
  originalMovementId?: mongoose.Types.ObjectId | string;
  businessDate: Date;
  createdBy: mongoose.Types.ObjectId | string;
  reason?: string;
  notes?: string;
}

export class InventoryService {
  /**
   * Ensures an InventoryBalance record exists for the given (productId, areaId)
   */
  static async ensureBalanceExists(
    productId: mongoose.Types.ObjectId | string,
    areaId: mongoose.Types.ObjectId | string,
    session?: ClientSession
  ): Promise<IInventoryBalance> {
    const pId = new mongoose.Types.ObjectId(productId);
    const aId = new mongoose.Types.ObjectId(areaId);

    const balance = await InventoryBalance.findOneAndUpdate(
      { productId: pId, areaId: aId },
      {
        $setOnInsert: {
          productId: pId,
          areaId: aId,
          availableQuantity: 0,
          damagedQuantity: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, session }
    );

    return balance;
  }

  /**
   * Atomic stock adjustment guarded against negative balances.
   * Creates an immutable ledger entry in InventoryMovement and updates InventoryBalance.
   */
  static async adjustStock(params: AdjustStockParams, session: ClientSession): Promise<IInventoryMovement> {
    const pId = new mongoose.Types.ObjectId(params.productId);
    const aId = new mongoose.Types.ObjectId(params.areaId);
    const availableDelta = Math.trunc(params.availableDelta);
    const damagedDelta = Math.trunc(params.damagedDelta || 0);

    if (availableDelta === 0 && damagedDelta === 0) {
      throw new BadRequestError('At least one quantity delta must be non-zero');
    }

    // Ensure balance document exists first
    await this.ensureBalanceExists(pId, aId, session);

    // Validate that a backdated deduction cannot produce negative historical balances
    if (availableDelta < 0 || damagedDelta < 0) {
      await this.validateHistoricalBalanceSafety(
        pId,
        aId,
        params.businessDate,
        availableDelta,
        damagedDelta,
        session
      );
    }

    // Build atomic update filter with safety guards
    const filter: Record<string, any> = {
      productId: pId,
      areaId: aId,
    };

    if (availableDelta < 0) {
      filter.availableQuantity = { $gte: Math.abs(availableDelta) };
    }

    if (damagedDelta < 0) {
      filter.damagedQuantity = { $gte: Math.abs(damagedDelta) };
    }

    const update: Record<string, any> = {
      $inc: {
        availableQuantity: availableDelta,
        damagedQuantity: damagedDelta,
      },
    };

    const updatedBalance = await InventoryBalance.findOneAndUpdate(filter, update, {
      new: true,
      session,
    });

    if (!updatedBalance) {
      if (availableDelta < 0) {
        throw new BadRequestError(
          `Insufficient available stock for product in area. Available quantity cannot become negative.`
        );
      }
      if (damagedDelta < 0) {
        throw new BadRequestError(
          `Insufficient damaged stock for product in area. Damaged quantity cannot become negative.`
        );
      }
      throw new BadRequestError(`Stock adjustment rejected due to balance constraints.`);
    }

    // Create immutable ledger movement record
    const [movement] = await InventoryMovement.create(
      [
        {
          productId: pId,
          areaId: aId,
          availableDelta,
          damagedDelta,
          movementType: params.movementType,
          sourceDocumentType: params.sourceDocumentType,
          sourceDocumentId: new mongoose.Types.ObjectId(params.sourceDocumentId),
          sourceDocumentLineId: params.sourceDocumentLineId
            ? new mongoose.Types.ObjectId(params.sourceDocumentLineId)
            : undefined,
          originalMovementId: params.originalMovementId
            ? new mongoose.Types.ObjectId(params.originalMovementId)
            : undefined,
          businessDate: params.businessDate,
          createdBy: new mongoose.Types.ObjectId(params.createdBy),
          reason: params.reason,
          notes: params.notes,
        },
      ],
      { session }
    );

    return movement;
  }

  /**
   * Validates that backdated deductions do not produce negative historical running balances.
   */
  static async validateHistoricalBalanceSafety(
    productId: mongoose.Types.ObjectId,
    areaId: mongoose.Types.ObjectId,
    businessDate: Date,
    availableDelta: number,
    damagedDelta: number,
    session: ClientSession
  ): Promise<void> {
    if (availableDelta >= 0 && damagedDelta >= 0) return;

    // If movement is strictly non-negative (adding stock), it cannot drive historical balances below zero
    if (availableDelta >= 0 && damagedDelta >= 0) {
      return;
    }

    // Check if there are movements with businessDate > this businessDate
    const hasLaterMovements = await InventoryMovement.findOne(
      {
        productId,
        areaId,
        businessDate: { $gt: businessDate },
      },
      null,
      { session }
    );

    if (!hasLaterMovements) return;

    // Calculate historical balance up to and including this businessDate
    const priorMovements = await InventoryMovement.aggregate([
      {
        $match: {
          productId,
          areaId,
          businessDate: { $lte: businessDate },
        },
      },
      {
        $group: {
          _id: null,
          available: { $sum: '$availableDelta' },
          damaged: { $sum: '$damagedDelta' },
        },
      },
    ]).session(session);

    let runningAvail = (priorMovements[0]?.available || 0) + availableDelta;
    let runningDmg = (priorMovements[0]?.damaged || 0) + damagedDelta;

    const dateStr = businessDate.toISOString().split('T')[0];

    if (runningAvail < 0) {
      throw new BadRequestError(
        `Backdated operation rejected: available balance would become negative (${runningAvail}) on ${dateStr}.`
      );
    }
    if (runningDmg < 0) {
      throw new BadRequestError(
        `Backdated operation rejected: damaged balance would become negative (${runningDmg}) on ${dateStr}.`
      );
    }

    // Now iterate forward through later movements
    const laterMovements = await InventoryMovement.find(
      {
        productId,
        areaId,
        businessDate: { $gt: businessDate },
      },
      null,
      { session }
    )
      .sort({ businessDate: 1, createdAt: 1 })
      .lean();

    for (const mov of laterMovements) {
      runningAvail += mov.availableDelta;
      runningDmg += mov.damagedDelta;
      const movDateStr = mov.businessDate ? new Date(mov.businessDate).toISOString().split('T')[0] : '';
      if (runningAvail < 0) {
        throw new BadRequestError(
          `Backdated operation rejected: applying this deduction would cause historical available balance to become negative (${runningAvail}) on ${movDateStr}.`
        );
      }
      if (runningDmg < 0) {
        throw new BadRequestError(
          `Backdated operation rejected: applying this deduction would cause historical damaged balance to become negative (${runningDmg}) on ${movDateStr}.`
        );
      }
    }
  }

  /**
   * Check if an area has any remaining active stock (available or damaged)
   */
  static async checkAreaHasStock(areaId: mongoose.Types.ObjectId | string): Promise<boolean> {
    const aId = new mongoose.Types.ObjectId(areaId);
    const balanceWithStock = await InventoryBalance.findOne({
      areaId: aId,
      $or: [{ availableQuantity: { $gt: 0 } }, { damagedQuantity: { $gt: 0 } }],
    });
    return !!balanceWithStock;
  }

  /**
   * Check if an area has any inventory movement history
   */
  static async checkAreaHasHistory(areaId: mongoose.Types.ObjectId | string): Promise<boolean> {
    const aId = new mongoose.Types.ObjectId(areaId);
    const count = await InventoryMovement.countDocuments({ areaId: aId });
    return count > 0;
  }

  /**
   * Check if a product has any inventory movement history
   */
  static async checkProductHasHistory(productId: mongoose.Types.ObjectId | string): Promise<boolean> {
    const pId = new mongoose.Types.ObjectId(productId);
    const count = await InventoryMovement.countDocuments({ productId: pId });
    return count > 0;
  }

  /**
   * Get all balances for a specific product grouped by area
   */
  static async getBalancesForProduct(productId: mongoose.Types.ObjectId | string) {
    const pId = new mongoose.Types.ObjectId(productId);
    const balances = await InventoryBalance.find({ productId: pId })
      .populate('areaId', 'areaNumber description isActive')
      .lean();

    // Sort numerically by areaNumber
    balances.sort((a: any, b: any) => {
      const numA = a.areaId?.areaNumber ?? 999999;
      const numB = b.areaId?.areaNumber ?? 999999;
      return numA - numB;
    });

    const totalAvailable = balances.reduce((sum, b) => sum + (b.availableQuantity || 0), 0);
    const totalDamaged = balances.reduce((sum, b) => sum + (b.damagedQuantity || 0), 0);

    return {
      balances,
      totalAvailable,
      totalDamaged,
    };
  }

  /**
   * Get balance for a specific product and area
   */
  static async getBalance(
    productId: mongoose.Types.ObjectId | string,
    areaId: mongoose.Types.ObjectId | string,
    session?: ClientSession
  ) {
    const pId = new mongoose.Types.ObjectId(productId);
    const aId = new mongoose.Types.ObjectId(areaId);

    const balance = await InventoryBalance.findOne({ productId: pId, areaId: aId }, null, {
      session,
    }).lean();

    return {
      availableQuantity: balance?.availableQuantity || 0,
      damagedQuantity: balance?.damagedQuantity || 0,
    };
  }
}

