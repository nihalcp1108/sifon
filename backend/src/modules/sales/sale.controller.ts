import { Response, NextFunction } from 'express';
import { SaleService } from './sale.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class SaleController {
  static async createSale(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sale = await SaleService.createSale(req.body, req.user!._id.toString());
      return sendCreated(res, sale, `Sale ${sale.reference} created successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async getSales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { sales, meta } = await SaleService.getSales(req.query as any);
      return sendSuccess(res, sales, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getSaleById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sale = await SaleService.getSaleById(req.params.id as string);
      return sendSuccess(res, sale);
    } catch (error) {
      next(error);
    }
  }

  static async postDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sale = await SaleService.postSaleDraft(req.params.id as string, req.user!._id.toString());
      return sendSuccess(res, sale, `Sale ${sale.reference} posted successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async updateDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sale = await SaleService.updateSaleDraft(req.params.id as string, req.body);
      return sendSuccess(res, sale, 'Sale draft updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await SaleService.deleteSaleDraft(req.params.id as string);
      return sendSuccess(res, { success: true }, 'Sale draft deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async cancelSale(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sale = await SaleService.cancelSale(
        req.params.id as string,
        req.body,
        req.user!._id.toString()
      );
      return sendSuccess(res, sale, `Sale ${sale.reference} cancelled successfully`);
    } catch (error) {
      next(error);
    }
  }
}
