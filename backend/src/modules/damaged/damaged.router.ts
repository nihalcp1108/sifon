import { Router } from 'express';
import { DamagedController } from './damaged.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/balances', DamagedController.getDamagedBalances);
router.get('/history', DamagedController.getDamagedHistory);

export default router;

