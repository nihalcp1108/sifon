import { Router } from 'express';
import { ReportController } from './report.controller.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  matrixStatementQuerySchema,
  periodStatementQuerySchema,
} from './report.validation.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/matrix',
  validateRequest({ query: matrixStatementQuerySchema }),
  ReportController.getStockMatrix
);
router.get(
  '/matrix/csv',
  validateRequest({ query: matrixStatementQuerySchema }),
  ReportController.exportStockMatrixCsv
);
router.get(
  '/period',
  validateRequest({ query: periodStatementQuerySchema }),
  ReportController.getPeriodStatement
);
router.get(
  '/period/csv',
  validateRequest({ query: periodStatementQuerySchema }),
  ReportController.exportPeriodStatementCsv
);

export default router;

