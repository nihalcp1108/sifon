import { Response, NextFunction } from 'express';
import { PurchaseService } from './purchase.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class PurchaseController {
  static async createPurchase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.createPurchase(req.body, req.user!._id.toString());
      return sendCreated(res, purchase, `Purchase ${purchase.reference} created successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async getPurchases(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { purchases, meta } = await PurchaseService.getPurchases(req.query as any);
      return sendSuccess(res, purchases, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getPurchaseById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.getPurchaseById(req.params.id as string);
      return sendSuccess(res, purchase);
    } catch (error) {
      next(error);
    }
  }

  static async postDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.postPurchaseDraft(req.params.id as string, req.user!._id.toString());
      return sendSuccess(res, purchase, `Purchase ${purchase.reference} posted successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async updateDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.updatePurchaseDraft(req.params.id as string, req.body);
      return sendSuccess(res, purchase, `Purchase draft updated successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async deleteDraft(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await PurchaseService.deletePurchaseDraft(req.params.id as string);
      return sendSuccess(res, { success: true }, `Purchase draft deleted successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async cancelPurchase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const purchase = await PurchaseService.cancelPurchase(
        req.params.id as string,
        req.body,
        req.user!._id.toString()
      );
      return sendSuccess(res, purchase, `Purchase ${purchase.reference} cancelled successfully`);
    } catch (error) {
      next(error);
    }
  }
}
