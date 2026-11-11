import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';

// Routers
import authRouter from './modules/auth/auth.router.js';
import dashboardRouter from './modules/dashboard/dashboard.router.js';
import productsRouter from './modules/products/product.router.js';
import areasRouter from './modules/areas/area.router.js';
import purchasesRouter from './modules/purchases/purchase.router.js';
import salesRouter from './modules/sales/sale.router.js';
import returnsRouter from './modules/returns/return.router.js';
import damagedRouter from './modules/damaged/damaged.router.js';
import reportsRouter from './modules/reports/report.router.js';

export function createApp(): express.Application {
  const app = express();

  // Trust reverse proxy (Railway, Render, Cloudflare) for secure cookie handling and HTTPS protocol detection
  app.set('trust proxy', 1);

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS configuration with explicit allowed origin
  const configuredOrigins = env.FRONTEND_URL.split(',')
    .map(o => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const defaultDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
  const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultDevOrigins]));

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) {
          return callback(null, true);
        }
        const normalized = origin.replace(/\/+$/, '').toLowerCase();
        const isAllowed = allowedOrigins.some(allowed => allowed.toLowerCase() === normalized);
        if (isAllowed) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Protection',
        'X-Idempotency-Key',
        'Idempotency-Key',
      ],
      exposedHeaders: ['X-Cache-Lookup', 'Content-Disposition'],
    })
  );

  // Body parsers with safe size limits
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // Global API rate limiter
  app.use('/api/', apiRateLimiter);

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'sifon-api',
      timestamp: new Date().toISOString(),
      timezone: env.TIMEZONE,
    });
  });

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'sifon-api',
      timestamp: new Date().toISOString(),
      timezone: env.TIMEZONE,
    });
  });

  // API v1 routes
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/dashboard', dashboardRouter);
  apiV1.use('/products', productsRouter);
  apiV1.use('/areas', areasRouter);
  apiV1.use('/purchases', purchasesRouter);
  apiV1.use('/sales', salesRouter);
  apiV1.use('/returns', returnsRouter);
  apiV1.use('/damaged', damagedRouter);
  apiV1.use('/reports', reportsRouter);

  app.use('/api/v1', apiV1);

  // Handle unmatched 404 routes
  app.use((_req: Request, _res: Response, next) => {
    next(new NotFoundError('The requested endpoint does not exist.'));
  });

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}

