import mongoose from 'mongoose';
import { Product, IProduct } from './product.model.js';
import { Area } from '../areas/area.model.js';
import { InventoryMovement } from '../inventory/inventory-movement.model.js';
import { InventoryBalance } from '../inventory/inventory-balance.model.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
  ProductOptionsQueryInput,
} from './product.validation.js';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { runInTransaction } from '../../utils/transactions.js';

export class ProductService {
  static async createProduct(input: CreateProductInput, userId: string): Promise<IProduct> {
    const existing = await Product.findOne({ code: input.code.toUpperCase() });
    if (existing) {
      throw new ConflictError(`Product with code ${input.code} already exists`);
    }

    // If opening stock is specified, validate areas exist and are active
    if (input.openingStock && input.openingStock.length > 0) {
      const areaIds = input.openingStock.map(o => o.areaId);
      const uniqueAreaIds = new Set(areaIds);
      if (uniqueAreaIds.size !== areaIds.length) {
        throw new BadRequestError('Duplicate area specified in opening stock');
      }

      for (const item of input.openingStock) {
        const area = await Area.findById(item.areaId);
        if (!area || !area.isActive) {
          throw new BadRequestError(`Area not found or inactive: ${item.areaId}`);
        }
      }
    }

    return await runInTransaction(async session => {
      const [product] = await Product.create(
        [
          {
            code: input.code.toUpperCase(),
            name: input.name,
            details: input.details,
            unit: input.unit || 'pcs',
            isActive: true,
          },
        ],
        { session }
      );

      if (input.openingStock && input.openingStock.length > 0) {
        for (const item of input.openingStock) {
          await InventoryService.adjustStock(
            {
              productId: product._id,
              areaId: item.areaId,
              availableDelta: item.quantity,
              movementType: 'OPENING_STOCK',
              sourceDocumentType: 'OPENING',
              sourceDocumentId: product._id,
              businessDate: new Date(0),
              createdBy: userId,
              reason: 'Initial Opening Stock',
            },
            session
          );
        }
      }

      return product;
    });
  }

  static async getProducts(query: ProductQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === true) {
      filter.isActive = { $ne: false };
    } else if (activeFilter === false) {
      filter.isActive = false;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const total = await Product.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Batch populate balances summary for all products in ONE single database query
    const enrichedProducts = await ProductService.batchEnrichProductsWithBalances(products);

    return {
      products: enrichedProducts,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Helper to batch enrich a list of products with area balances in a single round-trip.
   * Completely eliminates N+1 query bottlenecks and prevents Atlas connection pool exhaustion.
   */
  private static async batchEnrichProductsWithBalances(products: any[]) {
    if (!products.length) return [];

    const productIds = products.map(p => p._id);
    const allBalances = await InventoryBalance.find({ productId: { $in: productIds } })
      .populate('areaId', 'areaNumber description isActive')
      .lean();

    const balancesByProduct = new Map<string, any[]>();
    for (const b of allBalances) {
      const pIdStr = b.productId.toString();
      if (!balancesByProduct.has(pIdStr)) {
        balancesByProduct.set(pIdStr, []);
      }
      balancesByProduct.get(pIdStr)!.push(b);
    }

    return products.map(product => {
      const pIdStr = product._id.toString();
      const pBalances = (balancesByProduct.get(pIdStr) || []).slice();
      pBalances.sort((a: any, b: any) => {
        const numA = a.areaId?.areaNumber ?? 999999;
        const numB = b.areaId?.areaNumber ?? 999999;
        return numA - numB;
      });
      const totalAvailable = pBalances.reduce((sum: number, b: any) => sum + (b.availableQuantity || 0), 0);
      const totalDamaged = pBalances.reduce((sum: number, b: any) => sum + (b.damagedQuantity || 0), 0);

      return {
        _id: product._id,
        code: product.code,
        name: product.name,
        details: product.details,
        unit: product.unit || 'pcs',
        isActive: product.isActive,
        totalAvailable,
        totalDamaged,
        areaBalances: pBalances,
      };
    });
  }

  static async getProductOptions(query: ProductOptionsQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === false) {
      filter.isActive = false;
    } else {
      // By default for selector options, return active products
      filter.isActive = { $ne: false };
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const limit = query.limit || 100;
    const page = query.page || 1;

    let selectedProduct: any = null;
    if (query.selectedId && mongoose.Types.ObjectId.isValid(query.selectedId)) {
      selectedProduct = await Product.findById(query.selectedId).lean();
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let resultList = products;
    if (selectedProduct && !products.some(p => p._id.toString() === selectedProduct._id.toString())) {
      resultList = [selectedProduct, ...products];
    }

    // Batch populate balances summary for all product options in ONE single database query
    const enriched = await ProductService.batchEnrichProductsWithBalances(resultList);

    return {
      products: enriched,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getProductById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const product = await Product.findById(id).lean();
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const balances = await InventoryService.getBalancesForProduct(product._id);

    return {
      ...product,
      totalAvailable: balances.totalAvailable,
      totalDamaged: balances.totalDamaged,
      balances: balances.balances,
    };
  }

  static async getProductMovements(productId: string, page: number = 1, limit: number = 20) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const product = await Product.findById(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const filter = { productId: new mongoose.Types.ObjectId(productId) };
    const total = await InventoryMovement.countDocuments(filter);

    const movements = await InventoryMovement.find(filter)
      .populate('areaId', 'areaNumber description')
      .populate('createdBy', 'name email')
      .sort({ businessDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      movements,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async updateProduct(id: string, input: UpdateProductInput): Promise<IProduct> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const product = await Product.findById(id);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (input.name !== undefined) product.name = input.name;
    if (input.details !== undefined) product.details = input.details;
    if (input.unit !== undefined) product.unit = input.unit;
    if (input.isActive !== undefined) product.isActive = input.isActive;

    await product.save();
    return product;
  }
}

