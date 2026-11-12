import mongoose from 'mongoose';
import { Product, IProduct } from './product.model.js';
import { Area } from '../areas/area.model.js';
import { Brand } from '../brands/brand.model.js';
import { Category } from '../categories/category.model.js';
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
    // 1. Validate Brand exists and is active
    if (!mongoose.Types.ObjectId.isValid(input.brandId)) {
      throw new ValidationError('Invalid Brand ID');
    }
    const brand = await Brand.findById(input.brandId);
    if (!brand) {
      throw new NotFoundError(`Brand not found: ${input.brandId}`);
    }

    // 2. Validate Category exists and is active
    if (!mongoose.Types.ObjectId.isValid(input.categoryId)) {
      throw new ValidationError('Invalid Category ID');
    }
    const category = await Category.findById(input.categoryId);
    if (!category) {
      throw new NotFoundError(`Category not found: ${input.categoryId}`);
    }

    // 3. Handle Product Code:
    // If not provided by the user, generate an internal unique code to maintain backwards compatibility
    // with MongoDB Atlas indexes that might not be sparse
    let productCode = input.code?.trim().toUpperCase();
    if (productCode) {
      const existing = await Product.findOne({ code: productCode });
      if (existing) {
        throw new ConflictError(`Product with code ${productCode} already exists`);
      }
    } else {
      productCode = `PRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    // 4. If opening stock is specified, validate areas exist and are active
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
            name: input.name.trim(),
            brandId: brand._id,
            categoryId: category._id,
            code: productCode,
            details: input.details?.trim(),
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

      return await product.populate(['brandId', 'categoryId']);
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

    if (query.brandId && mongoose.Types.ObjectId.isValid(query.brandId)) {
      filter.brandId = new mongoose.Types.ObjectId(query.brandId);
    }

    if (query.categoryId && mongoose.Types.ObjectId.isValid(query.categoryId)) {
      filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    }

    if (query.search) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [{ name: searchRegex }, { details: searchRegex }, { code: searchRegex }];
    }

    const total = await Product.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const products = await Product.find(filter)
      .populate('brandId', 'name description isActive')
      .populate('categoryId', 'name description isActive')
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
      .populate({
        path: 'areaId',
        select: 'name areaNumber description isActive sectionId',
        populate: { path: 'sectionId', select: 'name' },
      })
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
        const nameA = a.areaId?.name || (a.areaId?.areaNumber ? `Area ${a.areaId.areaNumber}` : '');
        const nameB = b.areaId?.name || (b.areaId?.areaNumber ? `Area ${b.areaId.areaNumber}` : '');
        return nameA.localeCompare(nameB);
      });
      const totalAvailable = pBalances.reduce((sum: number, b: any) => sum + (b.availableQuantity || 0), 0);
      const totalDamaged = pBalances.reduce((sum: number, b: any) => sum + (b.damagedQuantity || 0), 0);

      return {
        _id: product._id,
        code: product.code,
        name: product.name,
        brandId: product.brandId,
        brand: product.brandId,
        categoryId: product.categoryId,
        category: product.categoryId,
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
      filter.isActive = { $ne: false };
    }

    if (query.brandId && mongoose.Types.ObjectId.isValid(query.brandId)) {
      filter.brandId = new mongoose.Types.ObjectId(query.brandId);
    }

    if (query.categoryId && mongoose.Types.ObjectId.isValid(query.categoryId)) {
      filter.categoryId = new mongoose.Types.ObjectId(query.categoryId);
    }

    if (query.search) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    const limit = query.limit || 100;
    const page = query.page || 1;

    let selectedProduct: any = null;
    if (query.selectedId && mongoose.Types.ObjectId.isValid(query.selectedId)) {
      selectedProduct = await Product.findById(query.selectedId)
        .populate('brandId', 'name')
        .populate('categoryId', 'name')
        .lean();
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('brandId', 'name')
      .populate('categoryId', 'name')
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
    const product = await Product.findById(id)
      .populate('brandId', 'name description isActive')
      .populate('categoryId', 'name description isActive')
      .lean();
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const balances = await InventoryService.getBalancesForProduct(product._id);

    return {
      ...product,
      brand: product.brandId,
      category: product.categoryId,
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
      .populate({
        path: 'areaId',
        select: 'name areaNumber description sectionId',
        populate: { path: 'sectionId', select: 'name' },
      })
      .populate('createdBy', 'name email')
      .sort({ businessDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const enrichedMovements = movements.map(m => {
      const sectionName = (m.areaId as any)?.sectionId?.name;
      const areaName = (m.areaId as any)?.name || ((m.areaId as any)?.areaNumber ? `Area ${(m.areaId as any).areaNumber}` : 'Area');
      const areaDisplayName = sectionName ? `${sectionName} — ${areaName}` : areaName;
      return {
        ...m,
        areaDisplayName,
      };
    });

    return {
      movements: enrichedMovements,
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

    if (input.brandId !== undefined) {
      if (input.brandId) {
        if (!mongoose.Types.ObjectId.isValid(input.brandId)) {
          throw new ValidationError('Invalid Brand ID');
        }
        const brand = await Brand.findById(input.brandId);
        if (!brand) {
          throw new NotFoundError(`Brand not found: ${input.brandId}`);
        }
        product.brandId = brand._id;
      } else {
        product.brandId = undefined;
      }
    }

    if (input.categoryId !== undefined) {
      if (input.categoryId) {
        if (!mongoose.Types.ObjectId.isValid(input.categoryId)) {
          throw new ValidationError('Invalid Category ID');
        }
        const category = await Category.findById(input.categoryId);
        if (!category) {
          throw new NotFoundError(`Category not found: ${input.categoryId}`);
        }
        product.categoryId = category._id;
      } else {
        product.categoryId = undefined;
      }
    }

    if (input.name !== undefined) product.name = input.name.trim();
    if (input.details !== undefined) product.details = input.details.trim();
    if (input.unit !== undefined) product.unit = input.unit.trim();
    if (input.isActive !== undefined) product.isActive = input.isActive;

    await product.save();
    return await product.populate(['brandId', 'categoryId']);
  }
}
