import { ACCOUNT_CATEGORIES, asDecimal } from '@bt/shared/types';
import { describe, expect, it } from '@jest/globals';
import Transactions from '@models/transactions.model';
import * as helpers from '@tests/helpers';
import { addMonths, format } from 'date-fns';

const dateOnly = (date: Date) => format(date, 'yyyy-MM-dd');

describe('Credit card installment plans', () => {
  it('creates planned ledger rows, reserves the limit and removes reservations on cancellation', async () => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({
        accountCategory: ACCOUNT_CATEGORIES.creditCard,
        creditLimit: asDecimal(500),
      }),
      raw: true,
    });

    const purchaseDate = dateOnly(new Date());
    const firstDueDate = dateOnly(addMonths(new Date(), 1));
    const plan = await helpers.makeRequest<{
      id: string;
      totalAmount: number;
      installments: { id: string; amount: number; transactionId: string; status: string }[];
    }, true>({
      method: 'post',
      url: '/credit-card-installments',
      payload: {
        accountId: account.id,
        description: 'Test purchase',
        purchaseDate,
        firstDueDate,
        currencyCode: account.currencyCode,
        totalAmount: 100,
        installmentCount: 3,
      },
      raw: true,
    });

    expect(plan.installments).toHaveLength(3);
    expect(plan.installments.reduce((sum, installment) => sum + Number(installment.amount), 0)).toBeCloseTo(100);
    expect(plan.installments.every((installment) => installment.transactionId)).toBe(true);
    expect(plan.installments.every((installment) => installment.status === 'planned')).toBe(true);

    const plannedRows = await Transactions.findAll({
      where: { userId: account.userId, accountId: account.id, isPlanned: true },
    });
    expect(plannedRows).toHaveLength(3);
    expect(new Set(plannedRows.map((row) => row.id))).toEqual(
      new Set(plan.installments.map((installment) => installment.transactionId)),
    );

    const exposure = await helpers.makeRequest<{
      reservedInstallments: number;
      availableCredit: number;
      refReservedInstallments: number;
    }, true>({
      method: 'get',
      url: `/credit-card-installments/accounts/${account.id}/exposure`,
      raw: true,
    });
    expect(Number(exposure.reservedInstallments)).toBeCloseTo(100);
    expect(Number(exposure.availableCredit)).toBeCloseTo(400);
    expect(Number(exposure.refReservedInstallments)).toBeGreaterThan(0);

    await helpers.makeRequest({
      method: 'delete',
      url: `/credit-card-installments/${plan.id}`,
    });

    const remainingPlannedRows = await Transactions.findAll({
      where: { userId: account.userId, accountId: account.id, isPlanned: true },
    });
    expect(remainingPlannedRows).toHaveLength(0);

    const afterCancellation = await helpers.makeRequest<{
      reservedInstallments: number;
      availableCredit: number;
    }, true>({
      method: 'get',
      url: `/credit-card-installments/accounts/${account.id}/exposure`,
      raw: true,
    });
    expect(Number(afterCancellation.reservedInstallments)).toBe(0);
    expect(Number(afterCancellation.availableCredit)).toBeCloseTo(500);
  });
});
