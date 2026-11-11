import mongoose from 'mongoose';
import { Return, IReturn } from './return.model.js';
import { Sale } from '../sales/sale.model.js';
import { Area } from '../areas/area.model.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreateReturnInput, CancelReturnInput, ReturnQueryInput } from './return.validation.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { parseDateStartInclusive, parseDateEndExclusive } from '../../utils/date.js';
import { runInTransaction } from '../../utils/transactions.js';

export class ReturnService {
  private static async generateReference(dateStr: string): Promise<string> {
    const cleanDate = dateStr.replace(/-/g, '');
    const count = await Return.countDocuments();
    const seq = (count + 1).toString().padStart(4, '0');
    return `RET-${cleanDate}-${seq}`;
  }

  static async createReturn(input: CreateReturnInput, userId: string): Promise<IReturn> {
    const businessDate = parseDateStartInclusive(input.returnDate);
    const reference = input.reference?.trim() || (await this.generateReference(input.returnDate));
    const totalReturnQty = input.nonDamagedQuantity + input.damagedQuantity;

    if (totalReturnQty <= 0) {
      throw new BadRequestError('Total return quantity must be greater than zero');
    }

    return await runInTransaction(async session => {
      // Find sale inside transaction with primary read
      const sale = await Sale.findById(input.saleId).session(session);
      if (!sale) {
        throw new NotFoundError('Original sale not found');
      }
      if (sale.status !== 'POSTED') {
        throw new BadRequestError(`Cannot return against sale with status: ${sale.status}. Only posted sales can be returned.`);
      }

      const saleLine = sale.items.find(i => i._id.toString() === input.saleLineId);
      if (!saleLine) {
        throw new NotFoundError(`Sale line item not found: ${input.saleLineId}`);
      }

      const currentReturned = saleLine.returnedQuantity || 0;
      const remainingReturnable = saleLine.quantity - currentReturned;

      if (totalReturnQty > remainingReturnable) {
        throw new BadRequestError(
          `Requested return quantity (${totalReturnQty}) exceeds remaining returnable quantity (${remainingReturnable}). ` +
          `Original sold: ${saleLine.quantity}, already returned: ${currentReturned}.`
        );
      }

      // Default receiving area to original sale line source area if not specified
      const receivingAreaId = input.receivingAreaId || saleLine.sourceAreaId.toString();
      const receivingArea = await Area.findById(receivingAreaId).session(session);
      if (!receivingArea) {
        throw new NotFoundError(`Receiving area not found: ${receivingAreaId}`);
      }
      if (!receivingArea.isActive) {
        throw new BadRequestError(`Cannot return into inactive Area ${receivingArea.areaNumber}`);
      }

      // Create return document
      const [returnDoc] = await Return.create(
        [
          {
            reference,
            returnDate: businessDate,
            saleId: sale._id,
            saleLineId: saleLine._id,
            productId: saleLine.productId,
            receivingAreaId: receivingArea._id,
            nonDamagedQuantity: input.nonDamagedQuantity,
            damagedQuantity: input.damagedQuantity,
            reason: input.reason,
            status: 'POSTED',
            createdBy: new mongoose.Types.ObjectId(userId),
          },
        ],
        { session }
      );

      // Increment returnedQuantity on sale line atomically
      saleLine.returnedQuantity = currentReturned + totalReturnQty;
      await sale.save({ session });

      // Apply stock movements:
      // Non-damaged return increases available stock
      if (input.nonDamagedQuantity > 0) {
        await InventoryService.adjustStock(
          {
            productId: saleLine.productId,
            areaId: receivingArea._id,
            availableDelta: input.nonDamagedQuantity,
            movementType: 'RETURN_AVAILABLE',
            sourceDocumentType: 'RETURN',
            sourceDocumentId: returnDoc._id,
            sourceDocumentLineId: saleLine._id,
            businessDate,
            createdBy: userId,
            reason: input.reason,
          },
          session
        );
      }

      // Damaged return increases damaged stock ONLY.
      // Rule: "Never reduce available stock again when recording a damaged sales return; that quantity already left available stock when sold."
      if (input.damagedQuantity > 0) {
        await InventoryService.adjustStock(
          {
            productId: saleLine.productId,
            areaId: receivingArea._id,
            availableDelta: 0,
            damagedDelta: input.damagedQuantity,
            movementType: 'RETURN_DAMAGED',
            sourceDocumentType: 'RETURN',
            sourceDocumentId: returnDoc._id,
            sourceDocumentLineId: saleLine._id,
            businessDate,
            createdBy: userId,
            reason: input.reason,
          },
          session
        );
      }

      return returnDoc;
    });
  }

  static async cancelReturn(
    returnId: string,
    input: CancelReturnInput,
    userId: string
  ): Promise<IReturn> {
    return await runInTransaction(async session => {
      const returnDoc = await Return.findById(returnId).session(session);
      if (!returnDoc) {
        throw new NotFoundError('Return not found');
      }
      if (returnDoc.status !== 'POSTED') {
        throw new BadRequestError(`Only posted returns can be cancelled. Current status: ${returnDoc.status}`);
      }

      const sale = await Sale.findById(returnDoc.saleId).session(session);
      if (!sale) {
        throw new NotFoundError('Original sale record not found');
      }

      const saleLine = sale.items.find(i => i._id.toString() === returnDoc.saleLineId.toString());
      if (saleLine) {
        const totalReturnQty = returnDoc.nonDamagedQuantity + returnDoc.damagedQuantity;
        saleLine.returnedQuantity = Math.max(0, (saleLine.returnedQuantity || 0) - totalReturnQty);
        await sale.save({ session });
      }

      // Reverse non-damaged return: reduces available stock
      if (returnDoc.nonDamagedQuantity > 0) {
        await InventoryService.adjustStock(
          {
            productId: returnDoc.productId,
            areaId: returnDoc.receivingAreaId,
            availableDelta: -returnDoc.nonDamagedQuantity, // Will fail if available balance < quantity
            movementType: 'RETURN_REVERSAL_AVAILABLE',
            sourceDocumentType: 'RETURN',
            sourceDocumentId: returnDoc._id,
            businessDate: new Date(),
            createdBy: userId,
            reason: input.reason,
          },
          session
        );
      }

      // Reverse damaged return: reduces damaged stock
      if (returnDoc.damagedQuantity > 0) {
        await InventoryService.adjustStock(
          {
            productId: returnDoc.productId,
            areaId: returnDoc.receivingAreaId,
            availableDelta: 0,
            damagedDelta: -returnDoc.damagedQuantity, // Will fail if damaged balance < quantity
            movementType: 'RETURN_REVERSAL_DAMAGED',
            sourceDocumentType: 'RETURN',
            sourceDocumentId: returnDoc._id,
            businessDate: new Date(),
            createdBy: userId,
            reason: input.reason,
          },
          session
        );
      }

      returnDoc.status = 'CANCELLED';
      returnDoc.cancellationReason = input.reason;
      returnDoc.cancelledAt = new Date();
      returnDoc.cancelledBy = new mongoose.Types.ObjectId(userId);
      await returnDoc.save({ session });

      return returnDoc;
    });
  }

  static async getReturns(query: ReturnQueryInput) {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.productId) {
      filter.productId = new mongoose.Types.ObjectId(query.productId);
    }

    if (query.areaId) {
      filter.receivingAreaId = new mongoose.Types.ObjectId(query.areaId);
    }

    if (query.saleId) {
      filter.saleId = new mongoose.Types.ObjectId(query.saleId);
    }

    if (query.startDate || query.endDate) {
      filter.returnDate = {};
      if (query.startDate) {
        filter.returnDate.$gte = parseDateStartInclusive(query.startDate);
      }
      if (query.endDate) {
        filter.returnDate.$lt = parseDateEndExclusive(query.endDate);
      }
    }

    const total = await Return.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const returns = await Return.find(filter)
      .populate('productId', 'code name unit')
      .populate('receivingAreaId', 'areaNumber description')
      .populate('saleId', 'reference saleDate')
      .populate('createdBy', 'name email')
      .sort({ returnDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      returns,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getReturnById(id: string): Promise<IReturn> {
    const returnDoc = await Return.findById(id)
      .populate('productId', 'code name unit')
      .populate('receivingAreaId', 'areaNumber description')
      .populate('saleId', 'reference saleDate items')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!returnDoc) {
      throw new NotFoundError('Return not found');
    }

    return returnDoc as any;
  }
}

