import { Router } from 'express';
import { SaleController } from './sale.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createSaleSchema,
  updateSaleDraftSchema,
  cancelSaleSchema,
  saleQuerySchema,
} from './sale.validation.js';
import { requireAuth } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  idempotencyMiddleware(),
  validateRequest({ body: createSaleSchema }),
  SaleController.createSale
);
router.get('/', validateRequest({ query: saleQuerySchema }), SaleController.getSales);
router.get('/:id', SaleController.getSaleById);
router.post('/:id/post', idempotencyMiddleware(), SaleController.postDraft);
router.put('/:id', validateRequest({ body: updateSaleDraftSchema }), SaleController.updateDraft);
router.delete('/:id', SaleController.deleteDraft);
router.post(
  '/:id/cancel',
  idempotencyMiddleware(),
  validateRequest({ body: cancelSaleSchema }),
  SaleController.cancelSale
);

export default router;

