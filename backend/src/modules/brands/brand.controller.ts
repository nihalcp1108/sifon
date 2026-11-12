import { Request, Response, NextFunction } from 'express';
import { BrandService } from './brand.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class BrandController {
  static async createBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const brand = await BrandService.createBrand(req.body);
      return sendCreated(res, brand, 'Brand created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getBrands(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BrandService.getBrands(req.query as any);
      return sendSuccess(res, result.brands, 'Brands retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  static async getBrandOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await BrandService.getBrandOptions(req.query as any);
      return sendSuccess(res, result.brands, 'Brand options retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  static async getBrandById(req: Request, res: Response, next: NextFunction) {
    try {
      const brand = await BrandService.getBrandById(req.params.id as string);
      return sendSuccess(res, brand, 'Brand retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateBrand(req: Request, res: Response, next: NextFunction) {
    try {
      const brand = await BrandService.updateBrand(req.params.id as string, req.body);
      return sendSuccess(res, brand, 'Brand updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteBrand(req: Request, res: Response, next: NextFunction) {
    try {
      await BrandService.deleteBrand(req.params.id as string);
      return sendSuccess(res, { message: 'Brand deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
