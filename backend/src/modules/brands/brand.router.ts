import { Router } from 'express';
import { BrandController } from './brand.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createBrandSchema,
  updateBrandSchema,
  brandQuerySchema,
  brandOptionsQuerySchema,
} from './brand.validation.js';
import { objectIdParamSchema } from '../../utils/query-validation.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// Require auth for all brand routes
router.use(requireAuth);

// 1. Static routes first
router.get('/', validateRequest({ query: brandQuerySchema }), BrandController.getBrands);
router.get('/options', validateRequest({ query: brandOptionsQuerySchema }), BrandController.getBrandOptions);
router.post('/', validateRequest({ body: createBrandSchema }), BrandController.createBrand);

// 2. Dynamic ID routes
router.get('/:id', validateRequest({ params: objectIdParamSchema }), BrandController.getBrandById);
router.put(
  '/:id',
  validateRequest({ params: objectIdParamSchema, body: updateBrandSchema }),
  BrandController.updateBrand
);
router.delete('/:id', validateRequest({ params: objectIdParamSchema }), BrandController.deleteBrand);

export default router;

