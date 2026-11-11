import { Router } from 'express';
import { ReturnController } from './return.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createReturnSchema,
  cancelReturnSchema,
  returnQuerySchema,
} from './return.validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  idempotencyMiddleware(),
  validateRequest({ body: createReturnSchema }),
  ReturnController.createReturn
);
router.get('/', validateRequest({ query: returnQuerySchema }), ReturnController.getReturns);
router.get('/:id', ReturnController.getReturnById);
router.post(
  '/:id/cancel',
  idempotencyMiddleware(),
  validateRequest({ body: cancelReturnSchema }),
  ReturnController.cancelReturn
);

export default router;

