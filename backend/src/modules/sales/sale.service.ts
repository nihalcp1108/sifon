import mongoose from 'mongoose';
import { Sale, ISale } from './sale.model.js';
import { Product } from '../products/product.model.js';
import { Area } from '../areas/area.model.js';
import { Return } from '../returns/return.model.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { InventoryBalance } from '../inventory/inventory-balance.model.js';
import { AuditLog } from '../audit/audit.model.js';
import {
  CreateSaleInput,
  UpdateSaleInput,
  UpdateSaleDraftInput,
  CancelSaleInput,
  SaleQueryInput,
} from './sale.validation.js';
import { BadRequestError, NotFoundError, ConflictError } from '../../utils/errors.js';
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

  static async updateSale(
    saleId: string,
    input: UpdateSaleInput,
    userId: string
  ): Promise<ISale> {
    return await runInTransaction(async session => {
      const sale = await Sale.findById(saleId).session(session);
      if (!sale) {
        throw new NotFoundError('Sale not found');
      }

      if (sale.status === 'CANCELLED') {
        throw new BadRequestError('Cancelled sales cannot be edited');
      }

      // Concurrency check
      if (input.expectedVersion !== undefined && sale.__v !== input.expectedVersion) {
        throw new ConflictError('This sale record was modified by another operation. Please reload and try again.');
      }
      if (input.updatedAt && new Date(sale.updatedAt).getTime() !== new Date(input.updatedAt).getTime()) {
        throw new ConflictError('This sale record was modified by another operation. Please reload and try again.');
      }

      // Reference uniqueness validation
      if (input.reference && input.reference.trim() !== sale.reference) {
        const cleanRef = input.reference.trim().toUpperCase();
        const existing = await Sale.findOne({ reference: cleanRef, _id: { $ne: sale._id } }).session(session);
        if (existing) {
          throw new ConflictError(`Sale reference "${cleanRef}" is already in use`);
        }
        sale.reference = cleanRef;
      }

      if (input.saleDate) {
        sale.saleDate = parseDateStartInclusive(input.saleDate);
      }

      if (input.notes !== undefined) {
        sale.notes = input.notes;
      }

      // Capture previous state snapshot for audit
      const previousSnapshot = {
        reference: sale.reference,
        saleDate: sale.saleDate,
        notes: sale.notes,
        status: sale.status,
        items: sale.items.map(i => ({
          productId: i.productId.toString(),
          sourceAreaId: i.sourceAreaId.toString(),
          quantity: i.quantity,
          returnedQuantity: i.returnedQuantity,
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
          const area = await Area.findById(item.sourceAreaId).session(session);
          if (!area) {
            throw new NotFoundError(`Location not found: ${item.sourceAreaId}`);
          }
          if (!area.isActive) {
            throw new BadRequestError(`Cannot sell stock from inactive location: ${area.name || area.areaNumber}`);
          }
        }

        // 2. Validate linked customer returns
        const linkedReturns = await Return.find({ saleId: sale._id, status: 'POSTED' }).session(session);
        if (linkedReturns.length > 0) {
          for (const origLine of sale.items) {
            const returnedQty = origLine.returnedQuantity || 0;
            if (returnedQty > 0) {
              const matchingNew = input.items.find(
                i =>
                  i.productId.toString() === origLine.productId.toString() &&
                  i.sourceAreaId.toString() === origLine.sourceAreaId.toString()
              );

              const prod = await Product.findById(origLine.productId).session(session);
              const prodName = prod?.name || 'Product';

              if (!matchingNew) {
                throw new BadRequestError(
                  `Cannot remove or change location for line item "${prodName}" because it has ${returnedQty} customer return(s) linked to it.`
                );
              }

              if (matchingNew.quantity < returnedQty) {
                throw new BadRequestError(
                  `Cannot reduce sold quantity of "${prodName}" to ${matchingNew.quantity} because ${returnedQty} units have already been returned by customers. Quantity must be at least ${returnedQty}.`
                );
              }
            }
          }
        }

        // 3. If sale is POSTED, calculate stock adjustments
        if (sale.status === 'POSTED') {
          // Group original items by (productId, sourceAreaId)
          const origGroup = new Map<string, { productId: mongoose.Types.ObjectId; areaId: mongoose.Types.ObjectId; qty: number }>();
          for (const item of sale.items) {
            const key = `${item.productId.toString()}_${item.sourceAreaId.toString()}`;
            const existing = origGroup.get(key) || { productId: item.productId, areaId: item.sourceAreaId, qty: 0 };
            existing.qty += item.quantity;
            origGroup.set(key, existing);
          }

          // Group new items by (productId, sourceAreaId)
          const newGroup = new Map<string, { productId: mongoose.Types.ObjectId; areaId: mongoose.Types.ObjectId; qty: number }>();
          for (const item of input.items) {
            const pId = new mongoose.Types.ObjectId(item.productId);
            const aId = new mongoose.Types.ObjectId(item.sourceAreaId);
            const key = `${pId.toString()}_${aId.toString()}`;
            const existing = newGroup.get(key) || { productId: pId, areaId: aId, qty: 0 };
            existing.qty += item.quantity;
            newGroup.set(key, existing);
          }

          // Union of keys
          const allKeys = new Set([...origGroup.keys(), ...newGroup.keys()]);
          const adjustments: { productId: mongoose.Types.ObjectId; areaId: mongoose.Types.ObjectId; delta: number }[] = [];

          for (const key of allKeys) {
            const orig = origGroup.get(key);
            const updated = newGroup.get(key);
            const origQty = orig?.qty || 0;
            const newQty = updated?.qty || 0;
            // stockDelta = origQty - newQty
            // positive delta = fewer items sold -> restores stock
            // negative delta = more items sold -> deducts stock
            const delta = origQty - newQty;
            const productId = updated?.productId || orig!.productId;
            const areaId = updated?.areaId || orig!.areaId;

            if (delta !== 0) {
              adjustments.push({ productId, areaId, delta });
            }
          }

          // First pass: Validate that any stock deduction (delta < 0, i.e. newQty > origQty) does not exceed current available stock
          for (const adj of adjustments) {
            if (adj.delta < 0) {
              const balance = await InventoryBalance.findOne({
                productId: adj.productId,
                areaId: adj.areaId,
              }).session(session);

              const currentAvailable = balance?.availableQuantity || 0;
              const requiredDeduction = Math.abs(adj.delta);

              if (currentAvailable < requiredDeduction) {
                const prod = await Product.findById(adj.productId).session(session);
                const area = await Area.findById(adj.areaId).session(session);
                const prodName = prod?.name || 'Product';
                const areaName = area?.displayName || area?.name || 'Location';
                throw new BadRequestError(
                  `Cannot update sale: insufficient available stock for "${prodName}" in location "${areaName}". Available stock is ${currentAvailable}, but ${requiredDeduction} additional units are required for this sale update.`
                );
              }
            }
          }

          // Second pass: Apply all stock adjustments and ledger movements
          for (const adj of adjustments) {
            if (adj.delta > 0) {
              // Fewer items sold -> restore stock
              await InventoryService.adjustStock(
                {
                  productId: adj.productId,
                  areaId: adj.areaId,
                  availableDelta: adj.delta, // positive
                  movementType: 'SALE_REVERSAL',
                  sourceDocumentType: 'SALE',
                  sourceDocumentId: sale._id,
                  businessDate: sale.saleDate,
                  createdBy: userId,
                  reason: `Sale ${sale.reference} edit: reduced quantity or location change`,
                  notes: `Sale updated by user`,
                },
                session
              );
            } else if (adj.delta < 0) {
              // More items sold -> deduct stock
              await InventoryService.adjustStock(
                {
                  productId: adj.productId,
                  areaId: adj.areaId,
                  availableDelta: adj.delta, // negative
                  movementType: 'SALE',
                  sourceDocumentType: 'SALE',
                  sourceDocumentId: sale._id,
                  businessDate: sale.saleDate,
                  createdBy: userId,
                  reason: `Sale ${sale.reference} edit: increased quantity`,
                  notes: `Sale updated by user`,
                },
                session
              );
            }
          }
        }

        // Update sale items, preserving returnedQuantity where applicable
        sale.items = input.items.map(i => {
          const origMatch = sale.items.find(
            orig =>
              orig.productId.toString() === i.productId.toString() &&
              orig.sourceAreaId.toString() === i.sourceAreaId.toString()
          );
          return {
            _id: new mongoose.Types.ObjectId(),
            productId: new mongoose.Types.ObjectId(i.productId),
            sourceAreaId: new mongoose.Types.ObjectId(i.sourceAreaId),
            quantity: i.quantity,
            returnedQuantity: origMatch ? origMatch.returnedQuantity : 0,
          };
        }) as any;
      }

      await sale.save({ session });

      // Audit Log entry
      await AuditLog.create(
        [
          {
            entityType: 'SALE',
            entityId: sale._id,
            action: 'UPDATE',
            performedBy: new mongoose.Types.ObjectId(userId),
            details: {
              previous: previousSnapshot,
              updated: {
                reference: sale.reference,
                saleDate: sale.saleDate,
                notes: sale.notes,
                status: sale.status,
                items: sale.items.map(i => ({
                  productId: i.productId.toString(),
                  sourceAreaId: i.sourceAreaId.toString(),
                  quantity: i.quantity,
                  returnedQuantity: i.returnedQuantity,
                })),
              },
            },
            timestamp: new Date(),
          },
        ],
        { session }
      );

      // Return fully populated sale
      const populated = await Sale.findById(sale._id)
        .populate('items.productId', 'code name unit')
        .populate('items.sourceAreaId', 'name areaNumber description')
        .populate('createdBy', 'name email')
        .session(session);

      return populated || sale;
    });
  }

  static async updateSaleDraft(
    saleId: string,
    input: UpdateSaleDraftInput,
    userId?: string
  ): Promise<ISale> {
    return this.updateSale(saleId, input, userId || 'system');
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
      .populate('items.sourceAreaId', 'name areaNumber description')
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
      .populate('items.sourceAreaId', 'name areaNumber description')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!sale) {
      throw new NotFoundError('Sale not found');
    }

    return sale as any;
  }
}

