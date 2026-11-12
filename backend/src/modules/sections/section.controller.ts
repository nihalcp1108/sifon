import { Request, Response, NextFunction } from 'express';
import { SectionService } from './section.service.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';

export class SectionController {
  static async createSection(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await SectionService.createSection(req.body);
      return sendCreated(res, section, 'Section created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getSections(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SectionService.getSections(req.query as any);
      return sendSuccess(res, result.sections, 'Sections retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  static async getSectionOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SectionService.getSectionOptions(req.query as any);
      return sendSuccess(res, result.sections, 'Section options retrieved successfully', 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  static async getSectionById(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await SectionService.getSectionById(req.params.id as string);
      return sendSuccess(res, section, 'Section retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateSection(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await SectionService.updateSection(req.params.id as string, req.body);
      return sendSuccess(res, section, 'Section updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteSection(req: Request, res: Response, next: NextFunction) {
    try {
      await SectionService.deleteSection(req.params.id as string);
      return sendSuccess(res, { message: 'Section deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
