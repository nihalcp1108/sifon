import mongoose from 'mongoose';
import { Sale, ISale } from './sale.model.js';
import { Product } from '../products/product.model.js';
import { Area } from '../areas/area.model.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreateSaleInput, UpdateSaleDraftInput, CancelSaleInput, SaleQueryInput } from './sale.validation.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { parseDateStartInclusive, parseDateEndExclusive } from '../../utils/date.js';
import { runInTransaction } from '../../utils/transactions.js';

export class SaleService {
  private static async generateReference(dateStr: string): Promise<string> {
    const cleanDate = dateStr.replace(/-/g, '');
    const count = await Sale.countDocuments();
    const seq = (count + 1).toString().padStart(4, '0');
    return `SAL-${cleanDate}-${seq}`;
  }

  static async createSale(input: CreateSaleInput, userId: string): Promise<ISale> {
    const businessDate = parseDateStartInclusive(input.saleDate);
    const reference = input.reference?.trim() || (await this.generateReference(input.saleDate));

    // Validate products and source areas
    for (const item of input.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product not found: ${item.productId}`);
      }
      if (!product.isActive) {
        throw new BadRequestError(`Cannot sell archived or inactive product: ${product.name} (${product.code})`);
      }

      const area = await Area.findById(item.sourceAreaId);
      if (!area) {
        throw new NotFoundError(`Area not found: ${item.sourceAreaId}`);
      }
      if (!area.isActive) {
        throw new BadRequestError(`Cannot sell from inactive Area ${area.areaNumber}`);
      }
    }

    const isDraft = !!input.isDraft;

    return await runInTransaction(async session => {
      const saleItems = input.items.map(i => ({
        _id: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(i.productId),
        sourceAreaId: new mongoose.Types.ObjectId(i.sourceAreaId),
        quantity: i.quantity,
        returnedQuantity: 0,
      }));

      const [sale] = await Sale.create(
        [
          {
            reference,
            saleDate: businessDate,
            items: saleItems,
            notes: input.notes,
            status: isDraft ? 'DRAFT' : 'POSTED',
            postedAt: isDraft ? undefined : new Date(),
            createdBy: new mongoose.Types.ObjectId(userId),
          },
        ],
        { session }
      );

      // If posted, apply stock ledger deductions atomically
      if (!isDraft) {
        for (const item of sale.items) {
          await InventoryService.adjustStock(
            {
              productId: item.productId,
              areaId: item.sourceAreaId,
              availableDelta: -item.quantity, // Reduces available stock
              movementType: 'SALE',
              sourceDocumentType: 'SALE',
              sourceDocumentId: sale._id,
              sourceDocumentLineId: item._id,
              businessDate,
              createdBy: userId,
              notes: sale.notes,
            },
            session
          );
        }
      }

      return sale;
    });
  }

  static async postSaleDraft(saleId: string, userId: string): Promise<ISale> {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      throw new NotFoundError('Sale not found');
    }
    if (sale.status !== 'DRAFT') {
      throw new BadRequestError(`Only draft sales can be posted. Current status: ${sale.status}`);
    }

    // Revalidate products and areas
    for (const item of sale.items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        throw new BadRequestError(`Product ${item.productId} is inactive or not found`);
      }
      const area = await Area.findById(item.sourceAreaId);
      if (!area || !area.isActive) {
        throw new BadRequestError(`Area ${item.sourceAreaId} is inactive or not found`);
      }
    }

    return await runInTransaction(async session => {
      sale.status = 'POSTED';
      sale.postedAt = new Date();
      await sale.save({ session });

      for (const item of sale.items) {
        await InventoryService.adjustStock(
          {
            productId: item.productId,
            areaId: item.sourceAreaId,
            availableDelta: -item.quantity,
            movementType: 'SALE',
            sourceDocumentType: 'SALE',
            sourceDocumentId: sale._id,
            sourceDocumentLineId: item._id,
            businessDate: sale.saleDate,
            createdBy: userId,
            notes: sale.notes,
          },
          session
        );
      }

      return sale;
    });
  }

  static async updateSaleDraft(saleId: string, input: UpdateSaleDraftInput): Promise<ISale> {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      throw new NotFoundError('Sale not found');
    }
    if (sale.status !== 'DRAFT') {
      throw new BadRequestError('Posted or cancelled sales cannot be edited');
    }

    if (input.saleDate) {
      sale.saleDate = parseDateStartInclusive(input.saleDate);
    }
    if (input.notes !== undefined) {
      sale.notes = input.notes;
    }
    if (input.items) {
      for (const item of input.items) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          throw new BadRequestError(`Invalid product: ${item.productId}`);
        }
        const area = await Area.findById(item.sourceAreaId);
        if (!area || !area.isActive) {
          throw new BadRequestError(`Invalid area: ${item.sourceAreaId}`);
        }
      }

      sale.items = input.items.map(i => ({
        _id: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(i.productId),
        sourceAreaId: new mongoose.Types.ObjectId(i.sourceAreaId),
        quantity: i.quantity,
        returnedQuantity: 0,
      })) as any;
    }

    await sale.save();
    return sale;
  }

  static async deleteSaleDraft(saleId: string): Promise<void> {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      throw new NotFoundError('Sale not found');
    }
    if (sale.status !== 'DRAFT') {
      throw new BadRequestError('Only draft sales can be deleted');
    }

    await Sale.findByIdAndDelete(saleId);
  }

  static async cancelSale(saleId: string, input: CancelSaleInput, userId: string): Promise<ISale> {
    const sale = await Sale.findById(saleId);
    if (!sale) {
      throw new NotFoundError('Sale not found');
    }
    if (sale.status !== 'POSTED') {
      throw new BadRequestError(`Only posted sales can be cancelled. Current status: ${sale.status}`);
    }

    // REQUIREMENT: Do not allow sale cancellation while active returns exist against it. Require those returns to be reversed first.
    const hasActiveReturns = sale.items.some(item => (item.returnedQuantity || 0) > 0);
    if (hasActiveReturns) {
      throw new BadRequestError(
        'Cannot cancel sale because active customer returns exist against one or more items. Reverse the associated returns first.'
      );
    }

    return await runInTransaction(async session => {
      // Restore available stock in source area for each sold line item
      for (const item of sale.items) {
        await InventoryService.adjustStock(
          {
            productId: item.productId,
            areaId: item.sourceAreaId,
            availableDelta: item.quantity, // Restores stock
            movementType: 'SALE_REVERSAL',
            sourceDocumentType: 'SALE',
            sourceDocumentId: sale._id,
            sourceDocumentLineId: item._id,
            businessDate: new Date(),
            createdBy: userId,
            reason: input.reason,
          },
          session
        );
      }

      sale.status = 'CANCELLED';
      sale.cancellationReason = input.reason;
      sale.cancelledAt = new Date();
      sale.cancelledBy = new mongoose.Types.ObjectId(userId);
      await sale.save({ session });

      return sale;
    });
  }

  static async getSales(query: SaleQueryInput) {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.productId) {
      filter['items.productId'] = new mongoose.Types.ObjectId(query.productId);
    }

    if (query.areaId) {
      filter['items.sourceAreaId'] = new mongoose.Types.ObjectId(query.areaId);
    }

    if (query.startDate || query.endDate) {
      filter.saleDate = {};
      if (query.startDate) {
        filter.saleDate.$gte = parseDateStartInclusive(query.startDate);
      }
      if (query.endDate) {
        filter.saleDate.$lt = parseDateEndExclusive(query.endDate);
      }
    }

    const total = await Sale.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const sales = await Sale.find(filter)
      .populate('items.productId', 'code name unit')
      .populate('items.sourceAreaId', 'areaNumber description')
      .populate('createdBy', 'name email')
      .sort({ saleDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      sales,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSaleById(id: string): Promise<ISale> {
    const sale = await Sale.findById(id)
      .populate('items.productId', 'code name unit')
      .populate('items.sourceAreaId', 'areaNumber description')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!sale) {
      throw new NotFoundError('Sale not found');
    }

    return sale as any;
  }
}

