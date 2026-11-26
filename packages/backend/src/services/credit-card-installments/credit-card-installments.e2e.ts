import { ACCOUNT_CATEGORIES, asDecimal } from '@bt/shared/types';
import { describe, expect, it } from '@jest/globals';
import { ERROR_CODES } from '@js/errors';
import CreditCardInstallments from '@models/credit-card-installments.model';
import Transactions from '@models/transactions.model';
import * as helpers from '@tests/helpers';
import { addMonths, format } from 'date-fns';

const dateOnly = (date: Date) => format(date, 'yyyy-MM-dd');

describe('Credit card installment plans', () => {
  it('updates dates, category and descriptions only while every installment is planned', async () => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({
        accountCategory: ACCOUNT_CATEGORIES.creditCard,
        creditLimit: asDecimal(500),
      }),
      raw: true,
    });
    const plan = await helpers.makeRequest<{
      id: string;
      description: string;
      installments: { id: string; dueDate: string; transactionId: string }[];
    }, true>({
      method: 'post',
      url: '/credit-card-installments',
      payload: {
        accountId: account.id,
        description: 'Original purchase',
        categoryId: global.DEFAULT_CATEGORY_ID,
        purchaseDate: dateOnly(new Date()),
        firstDueDate: dateOnly(addMonths(new Date(), 1)),
        currencyCode: account.currencyCode,
        totalAmount: 120,
        installmentCount: 3,
      },
      raw: true,
    });

    const newFirstDueDate = dateOnly(addMonths(new Date(), 2));
    const updated = await helpers.makeRequest<{
      id: string;
      description: string;
      purchaseDate: string;
      installments: { dueDate: string; transactionId: string; status: string }[];
    }, true>({
      method: 'patch',
      url: `/credit-card-installments/${plan.id}`,
      payload: {
        description: 'Updated purchase',
        categoryId: global.DEFAULT_CATEGORY_ID,
        purchaseDate: dateOnly(new Date()),
        firstDueDate: newFirstDueDate,
      },
      raw: true,
    });

    expect(updated.description).toBe('Updated purchase');
    expect(updated.installments.map((item) => item.dueDate)).toEqual([
      newFirstDueDate,
      dateOnly(addMonths(new Date(), 3)),
      dateOnly(addMonths(new Date(), 4)),
    ]);
    expect(updated.installments.every((item) => item.status === 'planned')).toBe(true);
    const plannedTransaction = await Transactions.findByPk(plan.installments[0]!.transactionId);
    expect(plannedTransaction?.note).toContain('Updated purchase');
    expect(plannedTransaction?.time.toISOString()).toContain(newFirstDueDate);
  });

  it('replaces the generated planned row when manually linking an existing real transaction', async () => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({
        accountCategory: ACCOUNT_CATEGORIES.creditCard,
        creditLimit: asDecimal(500),
      }),
      raw: true,
    });
    const plan = await helpers.makeRequest<{
      id: string;
      installments: { id: string; transactionId: string }[];
    }, true>({
      method: 'post',
      url: '/credit-card-installments',
      payload: {
        accountId: account.id,
        description: 'Manual reconciliation',
        categoryId: global.DEFAULT_CATEGORY_ID,
        purchaseDate: dateOnly(new Date()),
        firstDueDate: dateOnly(addMonths(new Date(), 1)),
        currencyCode: account.currencyCode,
        totalAmount: 100,
        installmentCount: 2,
      },
      raw: true,
    });

    const firstInstallment = plan.installments[0]!;
    const generatedPlannedTransactionId = firstInstallment.transactionId;
    const [importedTransaction] = await helpers.createTransaction({
      payload: helpers.buildTransactionPayload({
        accountId: account.id,
        amount: asDecimal(50),
      }),
      raw: true,
    });

    const linked = await helpers.makeRequest<{
      id: string;
      transactionId: string;
      status: string;
    }, true>({
      method: 'post',
      url: `/credit-card-installments/${plan.id}/installments/${firstInstallment.id}/link`,
      payload: { transactionId: importedTransaction.id },
      raw: true,
    });

    expect(linked.transactionId).toBe(importedTransaction.id);
    expect(linked.status).toBe('posted');
    expect(await Transactions.findByPk(generatedPlannedTransactionId)).toBeNull();
    expect(await Transactions.findByPk(importedTransaction.id)).not.toBeNull();

    // A reconciled installment is historical financial data: editing its parent
    // plan must fail rather than silently moving or renaming the posted entry.
    const editAfterReconciliation = await helpers.makeRequest({
      method: 'patch',
      url: `/credit-card-installments/${plan.id}`,
      payload: {
        description: 'Must remain unchanged',
        categoryId: global.DEFAULT_CATEGORY_ID,
        purchaseDate: dateOnly(new Date()),
        firstDueDate: dateOnly(addMonths(new Date(), 2)),
      },
      raw: false,
    });
    expect(editAfterReconciliation.statusCode).toBe(ERROR_CODES.ValidationError);

    const cancelAfterReconciliation = await helpers.makeRequest({
      method: 'delete',
      url: `/credit-card-installments/${plan.id}`,
      raw: false,
    });
    expect(cancelAfterReconciliation.statusCode).toBe(ERROR_CODES.ValidationError);

    const persistedPlan = await helpers.makeRequest<{
      id: string;
      description: string;
      installments: { status: string; transactionId: string }[];
    }, true>({
      method: 'get',
      url: '/credit-card-installments',
      raw: true,
    });
    const persisted = persistedPlan.find((item) => item.id === plan.id);
    expect(persisted?.description).toBe('Manual reconciliation');
    expect(persisted?.installments[0]?.status).toBe('posted');
    expect(persisted?.installments[0]?.transactionId).toBe(importedTransaction.id);
  });

  it('keeps the planned reservation intact when reconciliation is rejected', async () => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({
        accountCategory: ACCOUNT_CATEGORIES.creditCard,
        creditLimit: asDecimal(500),
      }),
      raw: true,
    });
    const plan = await helpers.makeRequest<{
      id: string;
      installments: { id: string; amount: number; transactionId: string; status: string }[];
    }, true>({
      method: 'post',
      url: '/credit-card-installments',
      payload: {
        accountId: account.id,
        description: 'Protected reservation',
        categoryId: global.DEFAULT_CATEGORY_ID,
        purchaseDate: dateOnly(new Date()),
        firstDueDate: dateOnly(addMonths(new Date(), 1)),
        currencyCode: account.currencyCode,
        totalAmount: 100,
        installmentCount: 2,
      },
      raw: true,
    });

    const installment = plan.installments[0]!;
    const reservedTransactionId = installment.transactionId;
    const [wrongAmountTransaction] = await helpers.createTransaction({
      payload: helpers.buildTransactionPayload({
        accountId: account.id,
        amount: asDecimal(49),
      }),
      raw: true,
    });

    const rejectedLink = await helpers.makeRequest({
      method: 'post',
      url: `/credit-card-installments/${plan.id}/installments/${installment.id}/link`,
      payload: { transactionId: wrongAmountTransaction.id },
      raw: false,
    });
    expect(rejectedLink.statusCode).toBe(ERROR_CODES.ValidationError);

    const persistedInstallment = await CreditCardInstallments.findByPk(installment.id);
    expect(persistedInstallment?.status).toBe('planned');
    expect(persistedInstallment?.transactionId).toBe(reservedTransactionId);
    expect(await Transactions.findByPk(reservedTransactionId)).not.toBeNull();
    expect((await Transactions.findByPk(wrongAmountTransaction.id))?.isPlanned).toBe(false);
  });

  it('does not cancel a plan when a planned row has already become a real transaction', async () => {
    const account = await helpers.createAccount({
      payload: helpers.buildAccountPayload({
        accountCategory: ACCOUNT_CATEGORIES.creditCard,
        creditLimit: asDecimal(500),
      }),
      raw: true,
    });
    const plan = await helpers.makeRequest<{
      id: string;
      installments: { id: string; transactionId: string; status: string }[];
    }, true>({
      method: 'post',
      url: '/credit-card-installments',
      payload: {
        accountId: account.id,
        description: 'Confirmed row protection',
        categoryId: global.DEFAULT_CATEGORY_ID,
        purchaseDate: dateOnly(new Date()),
        firstDueDate: dateOnly(addMonths(new Date(), 1)),
        currencyCode: account.currencyCode,
        totalAmount: 100,
        installmentCount: 2,
      },
      raw: true,
    });

    const installment = plan.installments[0]!;
    const transaction = await Transactions.findByPk(installment.transactionId);
    expect(transaction?.isPlanned).toBe(true);
    await transaction!.update({ isPlanned: false });

    const rejectedCancellation = await helpers.makeRequest({
      method: 'delete',
      url: `/credit-card-installments/${plan.id}`,
      raw: false,
    });
    expect(rejectedCancellation.statusCode).toBe(ERROR_CODES.ValidationError);

    const persistedPlan = await helpers.makeRequest<{
      id: string;
      status: string;
      installments: { id: string; transactionId: string; status: string }[];
    }[], true>({
      method: 'get',
      url: '/credit-card-installments',
      raw: true,
    });
    const persisted = persistedPlan.find((item) => item.id === plan.id);
    expect(persisted?.status).toBe('active');
    expect(persisted?.installments[0]?.status).toBe('planned');
    expect(persisted?.installments[0]?.transactionId).toBe(transaction!.id);
    expect(await Transactions.findByPk(transaction!.id)).not.toBeNull();
  });

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
        categoryId: global.DEFAULT_CATEGORY_ID,
        purchaseDate,
        firstDueDate,
        currencyCode: account.currencyCode,
        totalAmount: 100,
        installmentCount: 3,
      },
      raw: true,
    });

    expect(plan.installments).toHaveLength(3);
    const installmentMinorUnits = plan.installments.map((installment) =>
      Math.round(Number(installment.amount) * 100),
    );
    expect(installmentMinorUnits).toEqual([3333, 3333, 3334]);
    expect(installmentMinorUnits.reduce((sum, amount) => sum + amount, 0)).toBe(10000);
    expect(plan.installments.every((installment) => Number(installment.amount) > 0)).toBe(true);
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
