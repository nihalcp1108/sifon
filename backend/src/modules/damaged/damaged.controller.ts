import { Response, NextFunction } from 'express';
import { DamagedService } from './damaged.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';

export class DamagedController {
  static async getDamagedBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await DamagedService.getDamagedBalances(req.query as any);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  static async getDamagedHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { history, meta } = await DamagedService.getDamagedHistory(req.query as any);
      return sendSuccess(res, history, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }
}

