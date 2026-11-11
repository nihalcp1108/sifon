import { Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';

export class DashboardController {
  static async getSummary(_req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const summary = await DashboardService.getSummary();
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}

