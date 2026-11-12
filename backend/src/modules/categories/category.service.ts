import mongoose from 'mongoose';
import { Category, ICategory } from './category.model.js';
import { Product } from '../products/product.model.js';
import {
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryQueryInput,
  CategoryOptionsQueryInput,
} from './category.validation.js';
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors.js';

export class CategoryService {
  static async createCategory(input: CreateCategoryInput): Promise<ICategory> {
    const trimmedName = input.name.trim();

    // Check case-insensitive duplicate
    const existing = await Category.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
    if (existing) {
      throw new ConflictError(`Category "${trimmedName}" already exists`);
    }

    const category = await Category.create({
      name: trimmedName,
      description: input.description?.trim(),
      isActive: true,
    });

    return category;
  }

  static async getCategories(query: CategoryQueryInput) {
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

    const total = await Category.countDocuments(filter);
    const page = query.page || 1;
    const limit = query.limit || 20;

    const categories = await Category.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      categories,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCategoryOptions(query: CategoryOptionsQueryInput) {
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

    let selectedCategory: any = null;
    if (query.selectedId && mongoose.Types.ObjectId.isValid(query.selectedId)) {
      selectedCategory = await Category.findById(query.selectedId).lean();
    }

    const total = await Category.countDocuments(filter);
    const categories = await Category.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let resultList = categories;
    if (selectedCategory && !categories.some(c => c._id.toString() === selectedCategory._id.toString())) {
      resultList = [selectedCategory, ...categories].sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      categories: resultList,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCategoryById(id: string): Promise<ICategory> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }
    return category;
  }

  static async updateCategory(id: string, input: UpdateCategoryInput): Promise<ICategory> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      const existing = await Category.findOne({
        _id: { $ne: category._id },
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });
      if (existing) {
        throw new ConflictError(`Another category with name "${trimmedName}" already exists`);
      }
      category.name = trimmedName;
    }

    if (input.description !== undefined) {
      category.description = input.description.trim();
    }

    if (input.isActive !== undefined) {
      category.isActive = input.isActive;
    }

    await category.save();
    return category;
  }

  static async deleteCategory(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ID format for _id');
    }
    const category = await Category.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Check if any product references this category
    const productCount = await Product.countDocuments({ categoryId: category._id });
    if (productCount > 0) {
      throw new BadRequestError(
        `Cannot delete category "${category.name}" because it is currently assigned to ${productCount} product(s). Please reassign or remove those products before deleting this category.`
      );
    }

    await Category.findByIdAndDelete(id);
  }
}

