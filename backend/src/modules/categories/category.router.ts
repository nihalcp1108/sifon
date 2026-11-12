import { Router } from 'express';
import { CategoryController } from './category.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
  categoryOptionsQuerySchema,
} from './category.validation.js';
import { objectIdParamSchema } from '../../utils/query-validation.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// Require auth for all category routes
router.use(requireAuth);

// 1. Static routes first
router.get('/', validateRequest({ query: categoryQuerySchema }), CategoryController.getCategories);
router.get('/options', validateRequest({ query: categoryOptionsQuerySchema }), CategoryController.getCategoryOptions);
router.post('/', validateRequest({ body: createCategorySchema }), CategoryController.createCategory);

// 2. Dynamic ID routes
router.get('/:id', validateRequest({ params: objectIdParamSchema }), CategoryController.getCategoryById);
router.put(
  '/:id',
  validateRequest({ params: objectIdParamSchema, body: updateCategorySchema }),
  CategoryController.updateCategory
);
router.delete('/:id', validateRequest({ params: objectIdParamSchema }), CategoryController.deleteCategory);

export default router;

