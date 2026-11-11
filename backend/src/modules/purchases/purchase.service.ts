import mongoose from 'mongoose';
import { Purchase, IPurchase } from './purchase.model.js';
import { Product } from '../products/product.model.js';
import { Area } from '../areas/area.model.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { CreatePurchaseInput, UpdatePurchaseDraftInput, CancelPurchaseInput, PurchaseQueryInput } from './purchase.validation.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';
import { parseDateStartInclusive, parseDateEndExclusive } from '../../utils/date.js';
import { runInTransaction } from '../../utils/transactions.js';

export class PurchaseService {
  private static async generateReference(dateStr: string): Promise<string> {
    const cleanDate = dateStr.replace(/-/g, '');
    const count = await Purchase.countDocuments();
    const seq = (count + 1).toString().padStart(4, '0');
    return `PUR-${cleanDate}-${seq}`;
  }

  static async createPurchase(input: CreatePurchaseInput, userId: string): Promise<IPurchase> {
    const businessDate = parseDateStartInclusive(input.purchaseDate);
    const reference = input.reference?.trim() || (await this.generateReference(input.purchaseDate));

    // Validate products and areas
    for (const item of input.items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product not found: ${item.productId}`);
      }
      if (!product.isActive) {
        throw new BadRequestError(`Cannot purchase archived or inactive product: ${product.name} (${product.code})`);
      }

      const area = await Area.findById(item.receivingAreaId);
      if (!area) {
        throw new NotFoundError(`Area not found: ${item.receivingAreaId}`);
      }
      if (!area.isActive) {
        throw new BadRequestError(`Cannot receive purchase into inactive Area ${area.areaNumber}`);
      }
    }

    const isDraft = !!input.isDraft;

    return await runInTransaction(async session => {
      const purchaseItems = input.items.map(i => ({
        _id: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(i.productId),
        receivingAreaId: new mongoose.Types.ObjectId(i.receivingAreaId),
        quantity: i.quantity,
      }));

      const [purchase] = await Purchase.create(
        [
          {
            reference,
            purchaseDate: businessDate,
            items: purchaseItems,
            notes: input.notes,
            status: isDraft ? 'DRAFT' : 'POSTED',
            postedAt: isDraft ? undefined : new Date(),
            createdBy: new mongoose.Types.ObjectId(userId),
          },
        ],
        { session }
      );

      // If posted, apply stock ledger movements
      if (!isDraft) {
        for (const item of purchase.items) {
          await InventoryService.adjustStock(
            {
              productId: item.productId,
              areaId: item.receivingAreaId,
              availableDelta: item.quantity,
              movementType: 'PURCHASE',
              sourceDocumentType: 'PURCHASE',
              sourceDocumentId: purchase._id,
              sourceDocumentLineId: item._id,
              businessDate,
              createdBy: userId,
              notes: purchase.notes,
            },
            session
          );
        }
      }

      return purchase;
    });
  }

  static async postPurchaseDraft(purchaseId: string, userId: string): Promise<IPurchase> {
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    if (purchase.status !== 'DRAFT') {
      throw new BadRequestError(`Only draft purchases can be posted. Current status: ${purchase.status}`);
    }

    // Revalidate products and areas
    for (const item of purchase.items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        throw new BadRequestError(`Product ${item.productId} is inactive or not found`);
      }
      const area = await Area.findById(item.receivingAreaId);
      if (!area || !area.isActive) {
        throw new BadRequestError(`Area ${item.receivingAreaId} is inactive or not found`);
      }
    }

    return await runInTransaction(async session => {
      purchase.status = 'POSTED';
      purchase.postedAt = new Date();
      await purchase.save({ session });

      for (const item of purchase.items) {
        await InventoryService.adjustStock(
          {
            productId: item.productId,
            areaId: item.receivingAreaId,
            availableDelta: item.quantity,
            movementType: 'PURCHASE',
            sourceDocumentType: 'PURCHASE',
            sourceDocumentId: purchase._id,
            sourceDocumentLineId: item._id,
            businessDate: purchase.purchaseDate,
            createdBy: userId,
            notes: purchase.notes,
          },
          session
        );
      }

      return purchase;
    });
  }

  static async updatePurchaseDraft(purchaseId: string, input: UpdatePurchaseDraftInput): Promise<IPurchase> {
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    if (purchase.status !== 'DRAFT') {
      throw new BadRequestError('Posted or cancelled purchases cannot be edited');
    }

    if (input.purchaseDate) {
      purchase.purchaseDate = parseDateStartInclusive(input.purchaseDate);
    }
    if (input.notes !== undefined) {
      purchase.notes = input.notes;
    }
    if (input.items) {
      // Validate items
      for (const item of input.items) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          throw new BadRequestError(`Invalid product: ${item.productId}`);
        }
        const area = await Area.findById(item.receivingAreaId);
        if (!area || !area.isActive) {
          throw new BadRequestError(`Invalid area: ${item.receivingAreaId}`);
        }
      }

      purchase.items = input.items.map(i => ({
        _id: new mongoose.Types.ObjectId(),
        productId: new mongoose.Types.ObjectId(i.productId),
        receivingAreaId: new mongoose.Types.ObjectId(i.receivingAreaId),
        quantity: i.quantity,
      })) as any;
    }

    await purchase.save();
    return purchase;
  }

  static async deletePurchaseDraft(purchaseId: string): Promise<void> {
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    if (purchase.status !== 'DRAFT') {
      throw new BadRequestError('Only draft purchases can be deleted');
    }

    await Purchase.findByIdAndDelete(purchaseId);
  }

  static async cancelPurchase(
    purchaseId: string,
    input: CancelPurchaseInput,
    userId: string
  ): Promise<IPurchase> {
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    if (purchase.status !== 'POSTED') {
      throw new BadRequestError(`Only posted purchases can be cancelled. Current status: ${purchase.status}`);
    }

    return await runInTransaction(async session => {
      // Attempt compensating stock deductions
      for (const item of purchase.items) {
        await InventoryService.adjustStock(
          {
            productId: item.productId,
            areaId: item.receivingAreaId,
            availableDelta: -item.quantity, // Reduces stock
            movementType: 'PURCHASE_REVERSAL',
            sourceDocumentType: 'PURCHASE',
            sourceDocumentId: purchase._id,
            sourceDocumentLineId: item._id,
            businessDate: new Date(),
            createdBy: userId,
            reason: input.reason,
          },
          session
        );
      }

      purchase.status = 'CANCELLED';
      purchase.cancellationReason = input.reason;
      purchase.cancelledAt = new Date();
      purchase.cancelledBy = new mongoose.Types.ObjectId(userId);
      await purchase.save({ session });

      return purchase;
    });
  }

  static async getPurchases(query: PurchaseQueryInput) {
    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.productId) {
      filter['items.productId'] = new mongoose.Types.ObjectId(query.productId);
    }

    if (query.areaId) {
      filter['items.receivingAreaId'] = new mongoose.Types.ObjectId(query.areaId);
    }

    if (query.startDate || query.endDate) {
      filter.purchaseDate = {};
      if (query.startDate) {
        filter.purchaseDate.$gte = parseDateStartInclusive(query.startDate);
      }
      if (query.endDate) {
        filter.purchaseDate.$lt = parseDateEndExclusive(query.endDate);
      }
    }

    const total = await Purchase.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const purchases = await Purchase.find(filter)
      .populate('items.productId', 'code name unit')
      .populate('items.receivingAreaId', 'areaNumber description')
      .populate('createdBy', 'name email')
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      purchases,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPurchaseById(id: string): Promise<IPurchase> {
    const purchase = await Purchase.findById(id)
      .populate('items.productId', 'code name unit')
      .populate('items.receivingAreaId', 'areaNumber description')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }

    return purchase as any;
  }
}

