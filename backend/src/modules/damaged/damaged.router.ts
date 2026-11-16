import { Router } from 'express';
import { DamagedController } from './damaged.controller.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/balances', DamagedController.getDamagedBalances);
router.get('/history', DamagedController.getDamagedHistory);

export default router;

