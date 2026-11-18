import { Router } from 'express';
import { PurchaseController } from './purchase.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  updatePurchaseDraftSchema,
  cancelPurchaseSchema,
  purchaseQuerySchema,
} from './purchase.validation.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post(
  '/',
  idempotencyMiddleware(),
  validateRequest({ body: createPurchaseSchema }),
  PurchaseController.createPurchase
);
router.get('/', validateRequest({ query: purchaseQuerySchema }), PurchaseController.getPurchases);
router.get('/:id', PurchaseController.getPurchaseById);
router.post('/:id/post', idempotencyMiddleware(), PurchaseController.postDraft);
router.put(
  '/:id',
  idempotencyMiddleware(),
  validateRequest({ body: updatePurchaseSchema }),
  PurchaseController.updatePurchase
);
router.delete('/:id', idempotencyMiddleware(), PurchaseController.deletePurchase);
router.post(
  '/:id/cancel',
  idempotencyMiddleware(),
  validateRequest({ body: cancelPurchaseSchema }),
  PurchaseController.cancelPurchase
);

export default router;

