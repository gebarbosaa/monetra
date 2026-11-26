import { recordId } from '@common/lib/zod/custom-types';
import { createController } from '@controllers/helpers/controller-factory';
import * as service from '@services/credit-card-installments';
import { z } from 'zod';

const createSchema = z.object({
  body: z.object({
    accountId: recordId(),
    description: z.string().trim().min(1).max(200),
    purchaseDate: z.iso.date(),
    firstDueDate: z.iso.date(),
    currencyCode: z.string().min(1).max(20),
    totalAmount: z.number().positive(),
    refTotalAmount: z.number().positive(),
    installmentCount: z.number().int().min(2).max(48),
  }).strict(),
});

export const createInstallmentPlan = createController(createSchema, async ({ user, body }) => ({
  data: await service.createInstallmentPlan({ userId: user.id, ...body }),
  statusCode: 201,
}));

export const getInstallmentPlans = createController(
  z.object({ query: z.object({ accountId: recordId().optional() }) }),
  async ({ user, query }) => ({
    data: await service.getInstallmentPlans({ userId: user.id, accountId: query.accountId }),
  }),
);

export const cancelInstallmentPlan = createController(
  z.object({ params: z.object({ id: recordId() }) }),
  async ({ user, params }) => ({
    data: await service.cancelInstallmentPlan({ userId: user.id, id: params.id }),
  }),
);

export const getCreditCardInstallmentExposure = createController(
  z.object({ params: z.object({ accountId: recordId() }) }),
  async ({ user, params }) => ({
    data: await service.getCreditCardInstallmentExposure({ userId: user.id, accountId: params.accountId }),
  }),
);
