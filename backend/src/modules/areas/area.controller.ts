import { Request, Response, NextFunction } from 'express';
import { AreaService } from './area.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class AreaController {
  static async createArea(req: Request, res: Response, next: NextFunction) {
    try {
      const area = await AreaService.createArea(req.body);
      const label = (area as any).displayName || area.name || (area.areaNumber ? `Area ${area.areaNumber}` : 'Area');
      return sendCreated(res, area, `${label} created successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async getAreas(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { areas, meta } = await AreaService.getAreas(query);
      return sendSuccess(res, areas, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getAreaOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const query = (req as any).validatedQuery || req.query;
      const { areas, meta } = await AreaService.getAreaOptions(query);
      return sendSuccess(res, areas, undefined, 200, meta);
    } catch (error) {
      next(error);
    }
  }

  static async getAreaById(req: Request, res: Response, next: NextFunction) {
    try {
      const area = await AreaService.getAreaById(req.params.id as string);
      return sendSuccess(res, area);
    } catch (error) {
      next(error);
    }
  }

  static async updateArea(req: Request, res: Response, next: NextFunction) {
    try {
      const area = await AreaService.updateArea(req.params.id as string, req.body);
      const label = (area as any).displayName || area.name || (area.areaNumber ? `Area ${area.areaNumber}` : 'Area');
      return sendSuccess(res, area, `${label} updated successfully`);
    } catch (error) {
      next(error);
    }
  }

  static async deleteArea(req: Request, res: Response, next: NextFunction) {
    try {
      await AreaService.deleteArea(req.params.id as string);
      return sendSuccess(res, { success: true }, 'Area deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
