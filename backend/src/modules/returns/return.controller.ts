import { Response, NextFunction } from 'express';
import { ReturnService } from './return.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class ReturnController {
  static async createReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const returnDoc = await ReturnService.createReturn(req.body, req.user!._id.toString());
      return sendCreated(res, returnDoc, `Customer return ${returnDoc.reference} processed successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async getReturns(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { returns, meta } = await ReturnService.getReturns(req.query as any);
      return sendSuccess(res, returns, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getReturnById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const returnDoc = await ReturnService.getReturnById(req.params.id as string);
      return sendSuccess(res, returnDoc);
    } catch (error) {
      next(error);
    }
  }

  static async cancelReturn(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const returnDoc = await ReturnService.cancelReturn(
        req.params.id as string,
        req.body,
        req.user!._id.toString()
      );
      return sendSuccess(res, returnDoc, `Return ${returnDoc.reference} cancelled successfully`);
    } catch (error) {
      next(error);
    }
  }
}
