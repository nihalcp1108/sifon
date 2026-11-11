import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', DashboardController.getSummary);

export default router;

