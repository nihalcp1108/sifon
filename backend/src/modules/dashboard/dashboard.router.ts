import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/summary', DashboardController.getSummary);

export default router;

