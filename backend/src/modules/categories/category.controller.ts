import { Request, Response, NextFunction } from 'express';
import { CategoryService } from './category.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class CategoryController {
  static async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.createCategory(req.body);
      return sendCreated(res, category, 'Category created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CategoryService.getCategories(req.query as any);
      return sendSuccess(res, result.categories, 'Categories retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await CategoryService.getCategoryOptions(req.query as any);
      return sendSuccess(res, result.categories, 'Category options retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  static async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.getCategoryById(req.params.id as string);
      return sendSuccess(res, category, 'Category retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const category = await CategoryService.updateCategory(req.params.id as string, req.body);
      return sendSuccess(res, category, 'Category updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      await CategoryService.deleteCategory(req.params.id as string);
      return sendSuccess(res, { message: 'Category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
