import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  loginSchema,
  changeEmailSchema,
  changePasswordSchema,
  createProductViewerSchema,
  resetUserPasswordSchema,
  toggleUserStatusSchema,
} from './auth.validation.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { authRateLimiter, accountSettingsRateLimiter } from '../../middleware/rateLimiter.js';
import { objectIdParamSchema } from '../../utils/query-validation.js';

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

// Admin User Management endpoints (Employee / Product Viewers)
router.get('/users', requireAuth, requireAdmin, AuthController.listUsers);

router.post(
  '/users',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: createProductViewerSchema }),
  AuthController.createProductViewer
);

router.post(
  '/product-viewers',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: createProductViewerSchema }),
  AuthController.createProductViewer
);

router.post(
  '/viewers',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: createProductViewerSchema }),
  AuthController.createProductViewer
);

router.put(
  '/users/:id/password',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ params: objectIdParamSchema, body: resetUserPasswordSchema }),
  AuthController.resetUserPassword
);

router.put(
  '/users/:id/status',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ params: objectIdParamSchema, body: toggleUserStatusSchema }),
  AuthController.setUserStatus
);

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireAdmin, AuthController.listUsers);

usersRouter.post(
  '/',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ body: createProductViewerSchema }),
  AuthController.createProductViewer
);

usersRouter.put(
  '/:id/password',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ params: objectIdParamSchema, body: resetUserPasswordSchema }),
  AuthController.resetUserPassword
);

usersRouter.put(
  '/:id/status',
  requireAuth,
  requireAdmin,
  accountSettingsRateLimiter,
  validateRequest({ params: objectIdParamSchema, body: toggleUserStatusSchema }),
  AuthController.setUserStatus
);

export default router;


