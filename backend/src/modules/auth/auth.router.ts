import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  loginSchema,
  changeEmailSchema,
  changePasswordSchema,
} from './auth.validation.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { authRateLimiter, accountSettingsRateLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authRateLimiter, validateRequest({ body: loginSchema }), AuthController.login);
router.get('/me', requireAuth, AuthController.me);
router.post('/logout', requireAuth, AuthController.logout);

// Admin Account Settings endpoints
router.put(
  '/email',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: changeEmailSchema }),
  AuthController.changeEmail
);

router.put(
  '/account/email',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: changeEmailSchema }),
  AuthController.changeEmail
);

router.put(
  '/password',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: changePasswordSchema }),
  AuthController.changePassword
);

router.put(
  '/account/password',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: changePasswordSchema }),
  AuthController.changePassword
);

export default router;


