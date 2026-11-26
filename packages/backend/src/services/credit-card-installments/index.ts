import { ACCOUNT_CATEGORIES, ACCOUNT_STATUSES, ACCOUNT_TYPES, PAYMENT_TYPES, TRANSACTION_TRANSFER_NATURE, TRANSACTION_TYPES } from '@bt/shared/types';
import { roundToCurrency } from '@common/lib/currency-precision';
import { Money } from '@common/types/money';
import { calculateRefAmount } from '@services/calculate-ref-amount.service';
import { NotFoundError, ValidationError } from '@js/errors';
import Accounts from '@models/accounts.model';
import Categories from '@models/categories.model';
import CreditCardInstallmentPlans, {
  CREDIT_CARD_INSTALLMENT_PLAN_STATUSES,
} from '@models/credit-card-installment-plans.model';
import Transactions from '@models/transactions.model';
import * as TransactionModel from '@models/transactions.model';
import * as UsersCurrencies from '@models/users-currencies.model';
import { getUserSettings } from '@services/user-settings/get-user-settings';
import CreditCardInstallments, {
  CREDIT_CARD_INSTALLMENT_STATUSES,
} from '@models/credit-card-installments.model';

const dateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ValidationError({ message: 'Invalid date. Use YYYY-MM-DD.' });
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const normalized = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    normalized.getUTCFullYear() !== parts.year ||
    normalized.getUTCMonth() !== parts.month - 1 ||
    normalized.getUTCDate() !== parts.day
  ) {
    throw new ValidationError({ message: 'Invalid calendar date.' });
  }
  return parts;
};

const addMonthsClamped = (value: string, offset: number): string => {
  const { year, month, day } = dateParts(value);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
};

export async function createInstallmentPlan(input: {
  userId: number;
  accountId: string;
  description: string;
  categoryId: string;
  purchaseDate: string;
  firstDueDate: string;
  currencyCode: string;
  totalAmount: number;
  installmentCount: number;
}) {
  if (!Number.isInteger(input.installmentCount) || input.installmentCount < 2 || input.installmentCount > 48) {
    throw new ValidationError({ message: 'Installment count must be between 2 and 48.' });
  }
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new ValidationError({ message: 'Total amount must be a finite value greater than zero.' });
  }
  if (!input.description.trim() || input.description.trim().length > 200) {
    throw new ValidationError({ message: 'Description must contain between 1 and 200 characters.' });
  }
  const account = await Accounts.findOne({ where: { id: input.accountId, userId: input.userId } });
  if (!account) throw new NotFoundError({ message: 'Credit card account not found.' });
  if (account.status !== ACCOUNT_STATUSES.active) {
    throw new ValidationError({ message: 'Installment plans can only be created on active credit card accounts.' });
  }
  if (account.accountCategory !== ACCOUNT_CATEGORIES.creditCard) {
    throw new ValidationError({ message: 'Installment plans can only be created for credit card accounts.' });
  }
  if (account.currencyCode !== input.currencyCode) {
    throw new ValidationError({ message: 'The installment currency must match the credit card currency.' });
  }
  const category = await Categories.findOne({ where: { id: input.categoryId, userId: input.userId } });
  if (!category) throw new ValidationError({ message: 'Choose a valid expense category.' });

  dateParts(input.purchaseDate);
  dateParts(input.firstDueDate);
  if (input.firstDueDate < input.purchaseDate) {
    throw new ValidationError({ message: 'The first installment due date cannot precede the purchase date.' });
  }

  const total = await roundToCurrency({
    money: Money.fromDecimal(input.totalAmount),
    userId: input.userId,
    currencyCode: input.currencyCode,
    mode: 'half-up',
  });
  if (!total.isPositive()) throw new ValidationError({ message: 'Total amount must be greater than zero.' });

  const precision = await import('@common/lib/currency-precision');
  const baseCurrency = await UsersCurrencies.getBaseCurrency({ userId: input.userId });
  const refTotal = await calculateRefAmount({
    amount: total,
    userId: input.userId,
    definitionOwnerUserId: input.userId,
    date: input.purchaseDate,
    baseCode: input.currencyCode,
  });
  if (!refTotal.isPositive()) throw new ValidationError({ message: 'Reference amount must be greater than zero.' });
  const baseDecimals = await precision.getBaseCurrencyDecimals({ userId: input.userId });
  const roundedRefTotal = refTotal.roundHalfEven(baseDecimals);

  const amountPerInstallment = total.divide(input.installmentCount).round(
    await precision.getCurrencyDecimals({
      userId: input.userId,
      code: input.currencyCode,
    }),
  );
  const refPerInstallment = roundedRefTotal.divide(input.installmentCount).round(baseDecimals);

  const sequelize = CreditCardInstallmentPlans.sequelize;
  if (!sequelize) throw new Error('Credit card installment models are not initialized.');

  return sequelize.transaction(async (transaction) => {
    const plan = await CreditCardInstallmentPlans.create(
      {
        userId: input.userId,
        accountId: account.id,
        description: input.description.trim(),
        categoryId: category.id,
        purchaseDate: input.purchaseDate,
        currencyCode: input.currencyCode,
        totalAmount: total,
        refTotalAmount: roundedRefTotal,
        installmentCount: input.installmentCount,
        status: CREDIT_CARD_INSTALLMENT_PLAN_STATUSES.active,
      },
      { transaction },
    );

    const rows = [];
    let allocated = Money.zero();
    let allocatedRef = Money.zero();
    for (let index = 1; index <= input.installmentCount; index += 1) {
      const isLast = index === input.installmentCount;
      const amount = isLast ? total.subtract(allocated) : amountPerInstallment;
      const refAmount = isLast ? roundedRefTotal.subtract(allocatedRef) : refPerInstallment;
      allocated = allocated.add(amount);
      allocatedRef = allocatedRef.add(refAmount);
      rows.push({
        planId: plan.id,
        installmentNumber: index,
        dueDate: addMonthsClamped(input.firstDueDate, index - 1),
        amount,
        refAmount,
        transactionId: null,
        status: CREDIT_CARD_INSTALLMENT_STATUSES.planned,
      });
    }
    const installments = await CreditCardInstallments.bulkCreate(rows, { transaction });

    // Planned ledger rows reserve future installments without changing account balances.
    for (const installment of installments) {
      const plannedTransaction = await TransactionModel.createTransaction({
        userId: input.userId,
        definitionOwnerUserId: input.userId,
        transaction,
        amount: Money.fromDecimal(installment.amount),
        refAmount: Money.fromDecimal(installment.refAmount),
        transactionType: TRANSACTION_TYPES.expense,
        paymentType: PAYMENT_TYPES.creditCard,
        accountId: account.id,
        accountType: account.type,
        currencyCode: account.currencyCode,
        refCurrencyCode: baseCurrency.currency.code,
        transferNature: TRANSACTION_TRANSFER_NATURE.not_transfer,
        categoryId: category.id,
        note: input.description.trim() + ' — parcela ' + installment.installmentNumber + '/' + input.installmentCount,
        time: new Date(installment.dueDate + 'T12:00:00.000Z'),
        isPlanned: true,
        excludeFromStats: false,
      });
      await installment.update({ transactionId: plannedTransaction.id }, { transaction });
    }

    return CreditCardInstallmentPlans.findByPk(plan.id, {
      include: [{ model: CreditCardInstallments, as: 'installments' }],
      transaction,
    });
  });
}

export async function getInstallmentPlans({ userId, accountId }: { userId: number; accountId?: string }) {
  const where: Record<string, unknown> = { userId };
  if (accountId) where.accountId = accountId;
  return CreditCardInstallmentPlans.findAll({
    where,
    include: [{ model: CreditCardInstallments, as: 'installments' }],
    order: [['purchaseDate', 'DESC'], [{ model: CreditCardInstallments, as: 'installments' }, 'installmentNumber', 'ASC']],
  });
}

export async function linkInstallmentTransaction({
  userId,
  planId,
  installmentId,
  transactionId,
}: {
  userId: number;
  planId: string;
  installmentId: string;
  transactionId: string;
}) {
  const sequelize = CreditCardInstallmentPlans.sequelize;
  if (!sequelize) throw new Error('Credit card installment models are not initialized.');

  return sequelize.transaction(async (transaction) => {
    const plan = await CreditCardInstallmentPlans.findOne({
      where: { id: planId, userId, status: CREDIT_CARD_INSTALLMENT_PLAN_STATUSES.active },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!plan) throw new NotFoundError({ message: 'Active installment plan not found.' });

    const installment = await CreditCardInstallments.findOne({
      where: { id: installmentId, planId: plan.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!installment) throw new NotFoundError({ message: 'Installment not found.' });
    if (installment.status !== CREDIT_CARD_INSTALLMENT_STATUSES.planned) {
      throw new ValidationError({ message: 'This installment is already settled or cancelled.' });
    }

    const tx = await Transactions.findOne({
      where: { id: transactionId, userId, accountId: plan.accountId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!tx) throw new NotFoundError({ message: 'Transaction not found on this credit card.' });
    if (
      tx.transactionType !== TRANSACTION_TYPES.expense ||
      tx.transferNature !== TRANSACTION_TRANSFER_NATURE.not_transfer ||
      !Money.fromDecimal(tx.amount).equals(Money.fromDecimal(installment.amount)) ||
      tx.currencyCode !== plan.currencyCode
    ) {
      throw new ValidationError({
        message: 'The transaction must be an expense on this card with the same currency and installment amount.',
      });
    }

    const alreadyLinked = await CreditCardInstallments.findOne({
      where: { transactionId: tx.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (alreadyLinked && alreadyLinked.id !== installment.id) {
      throw new ValidationError({ message: 'This transaction is already linked to another installment.' });
    }

    // If this installment was initially represented by an auto-generated planned row,
    // allow an owner to replace that reservation with an already-imported real transaction.
    // Never delete a linked real transaction or silently detach it.
    if (installment.transactionId && installment.transactionId !== tx.id) {
      const previousPlanned = await Transactions.findOne({
        where: {
          id: installment.transactionId,
          userId,
          accountId: plan.accountId,
          isPlanned: true,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!previousPlanned) {
        throw new ValidationError({
          message: 'This installment is already linked to a real transaction and cannot be replaced.',
        });
      }
      await Transactions.destroy({
        where: { id: previousPlanned.id, userId, isPlanned: true },
        transaction,
        individualHooks: true,
      });
    }

    // A planned transaction has not touched the account balance yet. Turning it into
    // a real transaction moves the amount from reserved installments into card debt.
    if (tx.isPlanned) await tx.update({ isPlanned: false }, { transaction });

    await installment.update({
      transactionId: tx.id,
      status: CREDIT_CARD_INSTALLMENT_STATUSES.posted,
    }, { transaction });

    return installment.reload({ transaction });
  });
}

export async function cancelInstallmentPlan({ userId, id }: { userId: number; id: string }) {
  const sequelize = CreditCardInstallmentPlans.sequelize;
  if (!sequelize) throw new Error('Credit card installment models are not initialized.');
  return sequelize.transaction(async (transaction) => {
    const plan = await CreditCardInstallmentPlans.findOne({
      where: { id, userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!plan) throw new NotFoundError({ message: 'Installment plan not found.' });
    const postedCount = await CreditCardInstallments.count({
      where: { planId: plan.id, status: CREDIT_CARD_INSTALLMENT_STATUSES.posted },
      transaction,
    });
    if (postedCount > 0) {
      throw new ValidationError({
        message: 'A plan with posted installments cannot be cancelled. Reverse posted transactions first.',
      });
    }
    const plannedInstallments = await CreditCardInstallments.findAll({
      where: { planId: plan.id, status: CREDIT_CARD_INSTALLMENT_STATUSES.planned },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    for (const installment of plannedInstallments) {
      if (installment.transactionId) {
        await Transactions.destroy({
          where: { id: installment.transactionId, userId, isPlanned: true },
          transaction,
          individualHooks: true,
        });
      }
    }

    await CreditCardInstallments.update(
      { status: CREDIT_CARD_INSTALLMENT_STATUSES.cancelled },
      { where: { planId: plan.id, status: CREDIT_CARD_INSTALLMENT_STATUSES.planned }, transaction },
    );
    await plan.update({ status: CREDIT_CARD_INSTALLMENT_PLAN_STATUSES.cancelled }, { transaction });
    return plan.reload({ include: [{ model: CreditCardInstallments, as: 'installments' }], transaction });
  });
}

export async function getCreditCardInstallmentExposure({ userId, accountId }: { userId: number; accountId: string }) {
  const account = await Accounts.findOne({ where: { id: accountId, userId } });
  if (!account) throw new NotFoundError({ message: 'Credit card account not found.' });
  const plans = await CreditCardInstallmentPlans.findAll({
    where: { userId, accountId, status: CREDIT_CARD_INSTALLMENT_PLAN_STATUSES.active },
    include: [{
      model: CreditCardInstallments,
      as: 'installments',
      where: { status: CREDIT_CARD_INSTALLMENT_STATUSES.planned },
      required: false,
      include: [{
        model: Transactions,
        as: 'transaction',
        attributes: ['id', 'isPlanned'],
        where: { isPlanned: true },
        required: true,
      }],
    }],
  });
  const reserved = Money.sum(
    plans.flatMap((plan) => plan.installments ?? []).map((installment) => Money.fromDecimal(installment.amount)),
  );
  // Match the existing credit-utilization widget semantics: manual cards track debt as
  // a negative balance; provider-synced accounts already include the credit limit.
  const balanceIncludesCreditLimit = account.type !== ACCOUNT_TYPES.system;
  const userSettings = await getUserSettings({ userId });
  const balanceIsAvailableCredit = !!userSettings.includeCreditLimitInStats;
  const creditLimitMinusBalance = account.creditLimit.subtract(account.currentBalance);
  const used = balanceIncludesCreditLimit
    ? creditLimitMinusBalance.isPositive() ? creditLimitMinusBalance : Money.zero()
    : account.currentBalance.isNegative()
      ? account.currentBalance.abs()
      : balanceIsAvailableCredit && creditLimitMinusBalance.isPositive()
        ? creditLimitMinusBalance
        : Money.zero();
  const available = account.creditLimit.subtract(used).subtract(reserved);

  // Reference-currency values let dashboard aggregates combine cards with different currencies.
  const reservedRef = Money.sum(
    plans.flatMap((plan) => plan.installments ?? []).map((installment) => Money.fromDecimal(installment.refAmount)),
  );
  const refLimit = account.refCreditLimit;
  const refBalance = account.refCurrentBalance;
  const refLimitMinusBalance = refLimit.subtract(refBalance);
  const refUsed = balanceIncludesCreditLimit
    ? refLimitMinusBalance.isPositive() ? refLimitMinusBalance : Money.zero()
    : refBalance.isNegative()
      ? refBalance.abs()
      : balanceIsAvailableCredit && refLimitMinusBalance.isPositive()
        ? refLimitMinusBalance
        : Money.zero();
  const refAvailable = refLimit.subtract(refUsed).subtract(reservedRef);

  return {
    accountId,
    creditLimit: account.creditLimit,
    currentBalance: account.currentBalance,
    usedCredit: used,
    reservedInstallments: reserved,
    availableCredit: available.isNegative() ? Money.zero() : available,
    overLimit: available.isNegative(),
    refCreditLimit: refLimit,
    refUsedCredit: refUsed,
    refReservedInstallments: reservedRef,
    refAvailableCredit: refAvailable.isNegative() ? Money.zero() : refAvailable,
    refOverLimit: refAvailable.isNegative(),
  };
}
