import { Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class ProductController {
  static async createProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.createProduct(req.body, req.user!._id.toString());
      return sendCreated(res, product, `Product ${product.name} (${product.code}) created successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async getProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { products, meta } = await ProductService.getProducts(query);
      return sendSuccess(res, products, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getProductOptions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { products, meta } = await ProductService.getProductOptions(query);
      return sendSuccess(res, products, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getProductById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.getProductById(req.params.id as string);
      return sendSuccess(res, product);
    } catch (error) {
      next(error);
    }
  }

  static async getProductMovements(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const { movements, meta } = await ProductService.getProductMovements(req.params.id as string, page, limit);
      return sendSuccess(res, movements, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async updateProduct(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const product = await ProductService.updateProduct(req.params.id as string, req.body);
      return sendSuccess(res, product, 'Product updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
