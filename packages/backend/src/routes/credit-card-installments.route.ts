import {
  cancelInstallmentPlan,
  createInstallmentPlan,
  getCreditCardInstallmentExposure,
  getInstallmentPlans,
} from '@controllers/credit-card-installments';
import { authenticateSession } from '@middlewares/better-auth';
import { checkBaseCurrencyLock } from '@middlewares/check-base-currency-lock';
import { Router } from 'express';

const router = Router();
router.use(authenticateSession);
router.get('/', getInstallmentPlans);
router.post('/', checkBaseCurrencyLock, createInstallmentPlan);
router.delete('/:id', checkBaseCurrencyLock, cancelInstallmentPlan);
router.get('/accounts/:accountId/exposure', getCreditCardInstallmentExposure);

export default router;
