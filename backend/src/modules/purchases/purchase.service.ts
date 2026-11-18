import mongoose from 'mongoose';
import { Purchase, IPurchase } from './purchase.model.js';
import { Product } from '../products/product.model.js';
import { Area } from '../areas/area.model.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { InventoryBalance } from '../inventory/inventory-balance.model.js';
import { AuditLog } from '../audit/audit.model.js';
import {
  CreatePurchaseInput,
  UpdatePurchaseInput,
  UpdatePurchaseDraftInput,
  CancelPurchaseInput,
  PurchaseQueryInput,
} from './purchase.validation.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../utils/errors.js';
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

  static async updatePurchase(
    purchaseId: string,
    input: UpdatePurchaseInput,
    userId: string
  ): Promise<IPurchase> {
    return await runInTransaction(async session => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) {
        throw new NotFoundError('Purchase not found');
      }

      if (purchase.status === 'CANCELLED') {
        throw new BadRequestError('Cancelled purchases cannot be edited');
      }

      // Concurrency check
      if (input.expectedVersion !== undefined && purchase.__v !== input.expectedVersion) {
        throw new ConflictError('This purchase record was modified by another operation. Please reload and try again.');
      }
      if (input.updatedAt && new Date(purchase.updatedAt).getTime() !== new Date(input.updatedAt).getTime()) {
        throw new ConflictError('This purchase record was modified by another operation. Please reload and try again.');
      }

      // Reference uniqueness validation
      if (input.reference && input.reference.trim() !== purchase.reference) {
        const cleanRef = input.reference.trim().toUpperCase();
        const existing = await Purchase.findOne({ reference: cleanRef, _id: { $ne: purchase._id } }).session(session);
        if (existing) {
          throw new ConflictError(`Purchase reference "${cleanRef}" is already in use`);
        }
        purchase.reference = cleanRef;
      }

      if (input.purchaseDate) {
        purchase.purchaseDate = parseDateStartInclusive(input.purchaseDate);
      }

      if (input.notes !== undefined) {
        purchase.notes = input.notes;
      }

      // Capture previous snapshot for audit trail
      const previousSnapshot = {
        reference: purchase.reference,
        purchaseDate: purchase.purchaseDate,
        notes: purchase.notes,
        status: purchase.status,
        items: purchase.items.map(i => ({
          productId: i.productId.toString(),
          receivingAreaId: i.receivingAreaId.toString(),
          quantity: i.quantity,
        })),
      };

      if (input.items && input.items.length > 0) {
        // 1. Validate all new products and locations
        for (const item of input.items) {
          const product = await Product.findById(item.productId).session(session);
          if (!product) {
            throw new NotFoundError(`Product not found: ${item.productId}`);
          }
          if (!product.isActive) {
            throw new BadRequestError(`Cannot use archived product: ${product.name}`);
          }
          const area = await Area.findById(item.receivingAreaId).session(session);
          if (!area) {
            throw new NotFoundError(`Location not found: ${item.receivingAreaId}`);
          }
          if (!area.isActive) {
            throw new BadRequestError(`Cannot receive stock into inactive location: ${area.name || area.areaNumber}`);
          }
        }

        // 2. If purchase is POSTED, calculate stock adjustments
        if (purchase.status === 'POSTED') {
          // Group original items by (productId, receivingAreaId)
          const origGroup = new Map<string, { productId: mongoose.Types.ObjectId; areaId: mongoose.Types.ObjectId; qty: number }>();
          for (const item of purchase.items) {
            const key = `${item.productId.toString()}_${item.receivingAreaId.toString()}`;
            const existing = origGroup.get(key) || { productId: item.productId, areaId: item.receivingAreaId, qty: 0 };
            existing.qty += item.quantity;
            origGroup.set(key, existing);
          }

          // Group new items by (productId, receivingAreaId)
          const newGroup = new Map<string, { productId: mongoose.Types.ObjectId; areaId: mongoose.Types.ObjectId; qty: number }>();
          for (const item of input.items) {
            const pId = new mongoose.Types.ObjectId(item.productId);
            const aId = new mongoose.Types.ObjectId(item.receivingAreaId);
            const key = `${pId.toString()}_${aId.toString()}`;
            const existing = newGroup.get(key) || { productId: pId, areaId: aId, qty: 0 };
            existing.qty += item.quantity;
            newGroup.set(key, existing);
          }

          // Compute union of all affected (productId, areaId) keys
          const allKeys = new Set([...origGroup.keys(), ...newGroup.keys()]);
          const adjustments: { productId: mongoose.Types.ObjectId; areaId: mongoose.Types.ObjectId; delta: number }[] = [];

          for (const key of allKeys) {
            const orig = origGroup.get(key);
            const updated = newGroup.get(key);
            const origQty = orig?.qty || 0;
            const newQty = updated?.qty || 0;
            const delta = newQty - origQty; // Positive = add stock, Negative = remove stock
            const productId = updated?.productId || orig!.productId;
            const areaId = updated?.areaId || orig!.areaId;

            if (delta !== 0) {
              adjustments.push({ productId, areaId, delta });
            }
          }

          // First pass: Validate that any stock reduction (delta < 0) does not exceed current available stock
          for (const adj of adjustments) {
            if (adj.delta < 0) {
              const balance = await InventoryBalance.findOne({
                productId: adj.productId,
                areaId: adj.areaId,
              }).session(session);

              const currentAvailable = balance?.availableQuantity || 0;
              const requiredReduction = Math.abs(adj.delta);

              if (currentAvailable < requiredReduction) {
                const prod = await Product.findById(adj.productId).session(session);
                const area = await Area.findById(adj.areaId).session(session);
                const prodName = prod?.name || 'Product';
                const areaName = area?.displayName || area?.name || 'Location';
                throw new BadRequestError(
                  `Cannot update purchase: reducing stock for "${prodName}" in location "${areaName}" by ${requiredReduction} units would result in negative available stock. Current available stock is ${currentAvailable}.`
                );
              }
            }
          }

          // Second pass: Apply all stock adjustments and ledger movements
          for (const adj of adjustments) {
            if (adj.delta > 0) {
              await InventoryService.adjustStock(
                {
                  productId: adj.productId,
                  areaId: adj.areaId,
                  availableDelta: adj.delta,
                  movementType: 'PURCHASE',
                  sourceDocumentType: 'PURCHASE',
                  sourceDocumentId: purchase._id,
                  businessDate: purchase.purchaseDate,
                  createdBy: userId,
                  reason: `Purchase ${purchase.reference} edit: increased quantity`,
                  notes: `Purchase updated by user`,
                },
                session
              );
            } else if (adj.delta < 0) {
              await InventoryService.adjustStock(
                {
                  productId: adj.productId,
                  areaId: adj.areaId,
                  availableDelta: adj.delta, // negative
                  movementType: 'PURCHASE_REVERSAL',
                  sourceDocumentType: 'PURCHASE',
                  sourceDocumentId: purchase._id,
                  businessDate: purchase.purchaseDate,
                  createdBy: userId,
                  reason: `Purchase ${purchase.reference} edit: reduced quantity or location change`,
                  notes: `Purchase updated by user`,
                },
                session
              );
            }
          }
        }

        // Update purchase items
        purchase.items = input.items.map(i => ({
          _id: new mongoose.Types.ObjectId(),
          productId: new mongoose.Types.ObjectId(i.productId),
          receivingAreaId: new mongoose.Types.ObjectId(i.receivingAreaId),
          quantity: i.quantity,
        })) as any;
      }

      await purchase.save({ session });

      // Audit Log entry
      await AuditLog.create(
        [
          {
            entityType: 'PURCHASE',
            entityId: purchase._id,
            action: 'UPDATE',
            performedBy: new mongoose.Types.ObjectId(userId),
            details: {
              previous: previousSnapshot,
              updated: {
                reference: purchase.reference,
                purchaseDate: purchase.purchaseDate,
                notes: purchase.notes,
                status: purchase.status,
                items: purchase.items.map(i => ({
                  productId: i.productId.toString(),
                  receivingAreaId: i.receivingAreaId.toString(),
                  quantity: i.quantity,
                })),
              },
            },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      // Return fully populated purchase
      const populated = await Purchase.findById(purchase._id)
        .populate('items.productId', 'code name unit')
        .populate('items.receivingAreaId', 'name areaNumber description')
        .populate('createdBy', 'name email')
        .session(session);

      return populated || purchase;
    });
  }

  static async updatePurchaseDraft(
    purchaseId: string,
    input: UpdatePurchaseDraftInput,
    userId?: string
  ): Promise<IPurchase> {
    return this.updatePurchase(purchaseId, input, userId || 'system');
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
            businessDate: purchase.purchaseDate || new Date(),
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
      .populate('items.receivingAreaId', 'name areaNumber description')
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
      .populate('items.receivingAreaId', 'name areaNumber description')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }

    return purchase as any;
  }
}

