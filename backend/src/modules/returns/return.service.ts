import mongoose from 'mongoose';
import { Return, IReturn } from './return.model.js';
import { Sale } from '../sales/sale.model.js';
import { Product } from '../products/product.model.js';
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

    // Determine quantities
    let nonDamagedQty = input.nonDamagedQuantity || 0;
    let damagedQty = input.damagedQuantity || 0;

    if (input.quantity && input.quantity > 0) {
      const cond = (input.condition || 'USABLE').toUpperCase();
      if (cond === 'DAMAGED') {
        damagedQty = input.quantity;
        nonDamagedQty = 0;
      } else {
        nonDamagedQty = input.quantity;
        damagedQty = 0;
      }
    }

    const totalReturnQty = nonDamagedQty + damagedQty;
    if (totalReturnQty <= 0) {
      throw new BadRequestError('Total return quantity must be greater than zero');
    }

    return await runInTransaction(async session => {
      let targetProductId: mongoose.Types.ObjectId;
      let receivingAreaId = input.receivingAreaId;
      let sale: any = null;
      let saleLine: any = null;

      if (input.saleId && input.saleLineId) {
        // Legacy sale-linked return flow
        sale = await Sale.findById(input.saleId).session(session);
        if (!sale) {
          throw new NotFoundError('Original sale not found');
        }
        if (sale.status !== 'POSTED') {
          throw new BadRequestError(`Cannot return against sale with status: ${sale.status}. Only posted sales can be returned.`);
        }

        saleLine = sale.items.find((i: any) => i._id.toString() === input.saleLineId);
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

        targetProductId = saleLine.productId;
        receivingAreaId = receivingAreaId || saleLine.sourceAreaId.toString();

        // Increment returnedQuantity on sale line atomically
        saleLine.returnedQuantity = currentReturned + totalReturnQty;
        await sale.save({ session });
      } else if (input.productId) {
        // Product-based return flow
        if (!mongoose.Types.ObjectId.isValid(input.productId)) {
          throw new BadRequestError('Invalid Product ID');
        }
        const prod = await Product.findById(input.productId).session(session);
        if (!prod) {
          throw new NotFoundError('Product not found');
        }
        targetProductId = prod._id;
      } else {
        throw new BadRequestError('Either product or original sale must be specified');
      }

      if (!receivingAreaId || !mongoose.Types.ObjectId.isValid(receivingAreaId)) {
        throw new BadRequestError('Valid destination location is required');
      }

      const receivingArea = await Area.findById(receivingAreaId).session(session);
      if (!receivingArea) {
        throw new NotFoundError(`Destination location not found: ${receivingAreaId}`);
      }
      if (!receivingArea.isActive) {
        const label = receivingArea.displayName || receivingArea.name || 'this location';
        throw new BadRequestError(`Cannot return into inactive location: ${label}`);
      }

      const reasonText = input.notes?.trim() || input.reason?.trim() || 'Product return';
      const cond = damagedQty > 0 ? 'DAMAGED' : 'USABLE';

      // Create return document
      const [returnDoc] = await Return.create(
        [
          {
            reference,
            returnDate: businessDate,
            saleId: sale ? sale._id : undefined,
            saleLineId: saleLine ? saleLine._id : undefined,
            productId: targetProductId,
            receivingAreaId: receivingArea._id,
            nonDamagedQuantity: nonDamagedQty,
            damagedQuantity: damagedQty,
            condition: cond,
            reason: reasonText,
            status: 'POSTED',
            createdBy: new mongoose.Types.ObjectId(userId),
          },
        ],
        { session }
      );

      // Apply stock movements:
      // Usable (non-damaged) return increases available stock
      if (nonDamagedQty > 0) {
        await InventoryService.adjustStock(
          {
            productId: targetProductId,
            areaId: receivingArea._id,
            availableDelta: nonDamagedQty,
            movementType: 'RETURN_AVAILABLE',
            sourceDocumentType: 'RETURN',
            sourceDocumentId: returnDoc._id,
            sourceDocumentLineId: saleLine ? saleLine._id : undefined,
            businessDate,
            createdBy: userId,
            reason: reasonText,
          },
          session
        );
      }

      // Damaged return increases damaged stock ONLY.
      if (damagedQty > 0) {
        await InventoryService.adjustStock(
          {
            productId: targetProductId,
            areaId: receivingArea._id,
            availableDelta: 0,
            damagedDelta: damagedQty,
            movementType: 'RETURN_DAMAGED',
            sourceDocumentType: 'RETURN',
            sourceDocumentId: returnDoc._id,
            sourceDocumentLineId: saleLine ? saleLine._id : undefined,
            businessDate,
            createdBy: userId,
            reason: reasonText,
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

      // If return was linked to a sale, restore saleLine returnedQuantity
      if (returnDoc.saleId && returnDoc.saleLineId) {
        const sale = await Sale.findById(returnDoc.saleId).session(session);
        if (sale) {
          const saleLine = sale.items.find((i: any) => i._id.toString() === returnDoc.saleLineId?.toString());
          if (saleLine) {
            const totalReturnQty = returnDoc.nonDamagedQuantity + returnDoc.damagedQuantity;
            saleLine.returnedQuantity = Math.max(0, (saleLine.returnedQuantity || 0) - totalReturnQty);
            await sale.save({ session });
          }
        }
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
      .populate('receivingAreaId', 'name areaNumber description sectionId')
      .populate('saleId', 'reference saleDate')
      .populate('createdBy', 'name email')
      .sort({ returnDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const enrichedReturns = returns.map((r: any) => {
      const area = r.receivingAreaId;
      if (area && typeof area === 'object') {
        const areaName = area.name || (area.areaNumber ? `Area ${area.areaNumber}` : 'Location');
        area.displayName = area.displayName || areaName;
      }
      return r;
    });

    return {
      returns: enrichedReturns,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getReturnById(id: string): Promise<IReturn> {
    const returnDoc: any = await Return.findById(id)
      .populate('productId', 'code name unit')
      .populate('receivingAreaId', 'name areaNumber description sectionId')
      .populate('saleId', 'reference saleDate items')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!returnDoc) {
      throw new NotFoundError('Return not found');
    }

    if (returnDoc.receivingAreaId && typeof returnDoc.receivingAreaId === 'object') {
      const areaName = returnDoc.receivingAreaId.name || (returnDoc.receivingAreaId.areaNumber ? `Area ${returnDoc.receivingAreaId.areaNumber}` : 'Location');
      returnDoc.receivingAreaId.displayName = returnDoc.receivingAreaId.displayName || areaName;
    }

    return returnDoc as any;
  }
}

