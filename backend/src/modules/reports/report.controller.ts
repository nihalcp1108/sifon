import { Response, NextFunction } from 'express';
import { ReportService } from './report.service.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';

export class ReportController {
  static async getStockMatrix(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getCurrentStockMatrix(req.query as any);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  static async exportStockMatrixCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const csv = await ReportService.exportStockMatrixCsv(req.query as any);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sifon-stock-matrix.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  static async getPeriodStatement(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await ReportService.getPeriodMovementStatement(req.query as any);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  static async exportPeriodStatementCsv(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const csv = await ReportService.exportPeriodStatementCsv(req.query as any);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="sifon-period-statement.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }
}

