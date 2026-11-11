import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, IUser } from '../modules/auth/user.model.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    // Check cookie first
    if (req.cookies && req.cookies.sifon_token) {
      token = req.cookies.sifon_token;

      // CSRF check for cookie-authenticated mutating requests:
      // A custom header like X-Requested-With or X-Custom-Header cannot be sent cross-origin without CORS preflight
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const customHeader = req.header('X-Requested-With') || req.header('X-CSRF-Protection');
        if (!customHeader) {
          return next(new ForbiddenError('Missing CSRF protection header'));
        }
      }
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new UnauthorizedError('Authentication required'));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (jwtError) {
      return next(new UnauthorizedError('Invalid or expired authentication session'));
    }

    if (!decoded || !decoded.userId) {
      return next(new UnauthorizedError('Invalid token payload'));
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return next(new UnauthorizedError('User account not found or deactivated'));
    }

    const currentTokenVersion = user.tokenVersion ?? 0;
    if (decoded.tokenVersion === undefined || decoded.tokenVersion !== currentTokenVersion) {
      return next(new UnauthorizedError('Session has been invalidated. Please sign in again.'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}


