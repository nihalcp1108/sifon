import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Safe logging: avoid logging sensitive headers or payload
  if (err.statusCode && err.statusCode < 500) {
    // Client error (4xx) - log message only
    console.warn(`[ClientError] ${err.statusCode} - ${err.message}`);
  } else {
    // Server error (5xx) - log error without secrets
    console.error(`[ServerError] ${err.message}`, err.stack);
  }

  // Handle AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.name,
        details: err.details,
      },
    });
    return;
  }

  // Handle Mongo duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
      error: {
        code: 'DuplicateKeyError',
        field,
      },
    });
    return;
  }

  // Handle Mongoose cast error (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: `Invalid ID format for ${err.path}`,
      error: {
        code: 'CastError',
      },
    });
    return;
  }

  // Handle Mongoose validation error
  if (err.name === 'ValidationError') {
    const issues = Object.values(err.errors || {}).map((e: any) => ({
      path: e.path,
      message: e.message,
    }));
    res.status(422).json({
      success: false,
      message: 'Database validation failed',
      error: {
        code: 'ValidationError',
        details: issues,
      },
    });
    return;
  }

  // Handle JSON body parser syntax error (e.g. malformed JSON in POST /login)
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body',
      error: {
        code: 'BadRequest',
      },
    });
    return;
  }

  // Handle Mongo connection / server selection errors
  if (
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoTimeoutError'
  ) {
    res.status(503).json({
      success: false,
      message: 'Database service is temporarily unavailable. Please retry in a few moments.',
      error: {
        code: 'ServiceUnavailable',
      },
    });
    return;
  }

  // Handle generic client errors with 4xx status codes
  const status = (err as any).status || (err as any).statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({
      success: false,
      message: err.message || 'Client request error',
      error: {
        code: err.name || 'ClientError',
      },
    });
    return;
  }

  // Fallback 500 Internal Server Error
  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    error: {
      code: 'InternalServerError',
    },
  });
}

