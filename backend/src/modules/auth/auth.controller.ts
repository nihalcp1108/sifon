import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

const COOKIE_NAME = 'sifon_token';

function getCookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  };
}

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, token } = await AuthService.login(req.body);

      // Set secure HttpOnly cookie
      res.cookie(COOKIE_NAME, token, getCookieOptions());

      return sendSuccess(
        res,
        {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          token, // Included for non-browser/test clients
        },
        'Login successful'
      );
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      return sendSuccess(res, {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return sendSuccess(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async changeEmail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      await AuthService.changeEmail(user._id, req.body);

      // Invalidate existing session cookie
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return sendSuccess(
        res,
        { message: 'Email updated. Please sign in with your new email.' },
        'Email updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
      await AuthService.changePassword(user._id, req.body);

      // Invalidate existing session cookie
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return sendSuccess(
        res,
        { message: 'Password updated. Please sign in with your new password.' },
        'Password updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

