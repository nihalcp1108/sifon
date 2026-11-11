import { Router } from 'express';
import { PurchaseController } from './purchase.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createPurchaseSchema,
  updatePurchaseDraftSchema,
  cancelPurchaseSchema,
  purchaseQuerySchema,
} from './purchase.validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  idempotencyMiddleware(),
  validateRequest({ body: createPurchaseSchema }),
  PurchaseController.createPurchase
);
router.get('/', validateRequest({ query: purchaseQuerySchema }), PurchaseController.getPurchases);
router.get('/:id', PurchaseController.getPurchaseById);
router.post('/:id/post', idempotencyMiddleware(), PurchaseController.postDraft);
router.put('/:id', validateRequest({ body: updatePurchaseDraftSchema }), PurchaseController.updateDraft);
router.delete('/:id', PurchaseController.deleteDraft);
router.post(
  '/:id/cancel',
  idempotencyMiddleware(),
  validateRequest({ body: cancelPurchaseSchema }),
  PurchaseController.cancelPurchase
);

export default router;

