import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { IdempotencyRecord } from '../modules/inventory/idempotency.model.js';
import { ConflictError } from '../utils/errors.js';

export function idempotencyMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only handle mutating requests: POST, PUT, PATCH, DELETE
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = (req.header('X-Idempotency-Key') || req.header('Idempotency-Key'))?.trim();
    if (!idempotencyKey) {
      return next();
    }

    const payloadString = JSON.stringify(req.body || {});
    const requestHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    try {
      const existing = await IdempotencyRecord.findOne({ key: idempotencyKey });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          return next(
            new ConflictError('Idempotency key was previously used with a different request payload.')
          );
        }

        // Return cached response
        res.setHeader('X-Cache-Lookup', 'IDEMPOTENT-HIT');
        return res.status(existing.statusCode).json(existing.responseBody);
      }

      // Intercept res.json to store the response
      const originalJson = res.json.bind(res);
      res.json = (body: any): Response => {
        // Restore original method
        res.json = originalJson;

        // Store if successful 2xx response
        if (res.statusCode >= 200 && res.statusCode < 300) {
          IdempotencyRecord.create({
            key: idempotencyKey,
            endpoint: req.originalUrl,
            requestHash,
            statusCode: res.statusCode,
            responseBody: body,
          }).catch(err => {
            console.error('[Idempotency] Failed to save idempotency record:', err);
          });
        }

        return originalJson(body);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

