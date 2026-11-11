import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  productOptionsQuerySchema,
} from './product.validation.js';
import { objectIdParamSchema } from '../../utils/query-validation.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// Dedicated lookup endpoints for product selectors/dropdowns (registered before dynamic /:id)
router.get(
  '/options',
  validateRequest({ query: productOptionsQuerySchema }),
  ProductController.getProductOptions
);

router.get(
  '/active',
  validateRequest({ query: productOptionsQuerySchema }),
  ProductController.getProductOptions
);

router.post('/', validateRequest({ body: createProductSchema }), ProductController.createProduct);
router.get('/', validateRequest({ query: productQuerySchema }), ProductController.getProducts);

// Dynamic :id detail routes - strictly scoped with ObjectId parameter validation
router.get(
  '/:id',
  validateRequest({ params: objectIdParamSchema }),
  ProductController.getProductById
);

router.get(
  '/:id/movements',
  validateRequest({ params: objectIdParamSchema }),
  ProductController.getProductMovements
);

router.put(
  '/:id',
  validateRequest({ params: objectIdParamSchema, body: updateProductSchema }),
  ProductController.updateProduct
);

export default router;

