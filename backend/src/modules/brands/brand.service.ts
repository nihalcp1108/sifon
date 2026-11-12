import mongoose from 'mongoose';
import { Brand, IBrand } from './brand.model.js';
import { Product } from '../products/product.model.js';
import {
  CreateBrandInput,
  UpdateBrandInput,
  BrandQueryInput,
  BrandOptionsQueryInput,
} from './brand.validation.js';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';

export class BrandService {
  static async createBrand(input: CreateBrandInput): Promise<IBrand> {
    const trimmedName = input.name.trim();

    // Check case-insensitive duplicate
    const existing = await Brand.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (existing) {
      throw new ConflictError(`Brand "${trimmedName}" already exists`);
    }

    const brand = await Brand.create({
      name: trimmedName,
      description: input.description?.trim(),
      isActive: true,
    });

    return brand;
  }

  static async getBrands(query: BrandQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === true) {
      filter.isActive = { $ne: false };
    } else if (activeFilter === false) {
      filter.isActive = false;
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    const total = await Brand.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const brands = await Brand.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      brands,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getBrandOptions(query: BrandOptionsQueryInput) {
    const filter: Record<string, any> = {};

    const activeFilter = query.activeOnly ?? query.isActive;
    if (activeFilter === false) {
      filter.isActive = false;
    } else {
      filter.isActive = { $ne: false };
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.name = searchRegex;
    }

    const limit = query.limit || 100;
    const page = query.page || 1;

    let selectedBrand: any = null;
    if (query.selectedId && mongoose.Types.ObjectId.isValid(query.selectedId)) {
      selectedBrand = await Brand.findById(query.selectedId).lean();
    }

    const total = await Brand.countDocuments(filter);
    const brands = await Brand.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let resultList = brands;
    if (selectedBrand && !brands.some(b => b._id.toString() === selectedBrand._id.toString())) {
      resultList = [selectedBrand, ...brands].sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      brands: resultList,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getBrandById(id: string): Promise<IBrand> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }
    return brand;
  }

  static async updateBrand(id: string, input: UpdateBrandInput): Promise<IBrand> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      const existing = await Brand.findOne({
        _id: { $ne: brand._id },
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (existing) {
        throw new ConflictError(`Another brand with name "${trimmedName}" already exists`);
      }
      brand.name = trimmedName;
    }

    if (input.description !== undefined) {
      brand.description = input.description.trim();
    }

    if (input.isActive !== undefined) {
      brand.isActive = input.isActive;
    }

    await brand.save();
    return brand;
  }

  static async deleteBrand(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // Check if any product references this brand
    const productCount = await Product.countDocuments({ brandId: brand._id });
    if (productCount > 0) {
      throw new BadRequestError(
        `Cannot delete brand "${brand.name}" because it is currently assigned to ${productCount} product(s). Please reassign or remove those products before deleting this brand.`
      );
    }

    await Brand.findByIdAndDelete(id);
  }
}

