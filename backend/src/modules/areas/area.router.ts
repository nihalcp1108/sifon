import { Router } from 'express';
import { AreaController } from './area.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createAreaSchema,
  updateAreaSchema,
  areaQuerySchema,
  areaOptionsQuerySchema,
} from './area.validation.js';
import { objectIdParamSchema } from '../../utils/query-validation.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// Dedicated lookup endpoints for area selectors/dropdowns (registered before dynamic /:id)
router.get(
  '/options',
  validateRequest({ query: areaOptionsQuerySchema }),
  AreaController.getAreaOptions
);

router.get(
  '/active',
  validateRequest({ query: areaOptionsQuerySchema }),
  AreaController.getAreaOptions
);

router.post('/', validateRequest({ body: createAreaSchema }), AreaController.createArea);
router.get('/', validateRequest({ query: areaQuerySchema }), AreaController.getAreas);

// Dynamic :id detail routes - strictly scoped with ObjectId parameter validation
router.get(
  '/:id',
  validateRequest({ params: objectIdParamSchema }),
  AreaController.getAreaById
);

router.put(
  '/:id',
  validateRequest({ params: objectIdParamSchema, body: updateAreaSchema }),
  AreaController.updateArea
);

router.delete(
  '/:id',
  validateRequest({ params: objectIdParamSchema }),
  AreaController.deleteArea
);

export default router;

