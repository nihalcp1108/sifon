import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

interface RequestValidationSchema {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

export function validateRequest(schemas: RequestValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const validatedBody = await schemas.body.parseAsync(req.body);
        req.body = validatedBody;
        (req as any).validatedBody = validatedBody;
        res.locals.validatedBody = validatedBody;
      }
      if (schemas.query) {
        const validatedQuery = await schemas.query.parseAsync(req.query);
        (req as any).validatedQuery = validatedQuery;
        res.locals.validatedQuery = validatedQuery;
      }
      if (schemas.params) {
        const validatedParams = await schemas.params.parseAsync(req.params);
        (req as any).validatedParams = validatedParams;
        res.locals.validatedParams = validatedParams;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        return next(new ValidationError('Invalid request parameters', issues));
      }
      next(error);
    }
  };
}
