import { Router } from 'express';
import { SectionController } from './section.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  createSectionSchema,
  updateSectionSchema,
  sectionQuerySchema,
  sectionOptionsQuerySchema,
} from './section.validation.js';
import { objectIdParamSchema } from '../../utils/query-validation.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

// Require auth for all section routes
router.use(requireAuth);

// 1. Static routes first
router.get('/', validateRequest({ query: sectionQuerySchema }), SectionController.getSections);
router.get('/options', validateRequest({ query: sectionOptionsQuerySchema }), SectionController.getSectionOptions);
router.post('/', validateRequest({ body: createSectionSchema }), SectionController.createSection);

// 2. Dynamic ID routes
router.get('/:id', validateRequest({ params: objectIdParamSchema }), SectionController.getSectionById);
router.put(
  '/:id',
  validateRequest({ params: objectIdParamSchema, body: updateSectionSchema }),
  SectionController.updateSection
);
router.delete('/:id', validateRequest({ params: objectIdParamSchema }), SectionController.deleteSection);

export default router;

