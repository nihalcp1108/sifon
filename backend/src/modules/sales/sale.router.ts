import { Router } from 'express';
import { SaleController } from './sale.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createSaleSchema,
  updateSaleSchema,
  updateSaleDraftSchema,
  cancelSaleSchema,
  saleQuerySchema,
} from './sale.validation.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.post(
  '/',
  idempotencyMiddleware(),
  validateRequest({ body: createSaleSchema }),
  SaleController.createSale
);
router.get('/', validateRequest({ query: saleQuerySchema }), SaleController.getSales);
router.get('/:id', SaleController.getSaleById);
router.post('/:id/post', idempotencyMiddleware(), SaleController.postDraft);
router.put(
  '/:id',
  idempotencyMiddleware(),
  validateRequest({ body: updateSaleSchema }),
  SaleController.updateSale
);
router.delete('/:id', idempotencyMiddleware(), SaleController.deleteSale);
router.post(
  '/:id/cancel',
  idempotencyMiddleware(),
  validateRequest({ body: cancelSaleSchema }),
  SaleController.cancelSale
);

export default router;

