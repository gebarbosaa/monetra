import { ACCOUNT_CATEGORIES } from '@bt/shared/types';
import { roundToCurrency } from '@common/lib/currency-precision';
import { Money } from '@common/types/money';
import { calculateRefAmount } from '@services/calculate-ref-amount.service';
import { NotFoundError, ValidationError } from '@js/errors';
import Accounts from '@models/accounts.model';
import CreditCardInstallmentPlans, {
  CREDIT_CARD_INSTALLMENT_PLAN_STATUSES,
} from '@models/credit-card-installment-plans.model';
import CreditCardInstallments, {
  CREDIT_CARD_INSTALLMENT_STATUSES,
} from '@models/credit-card-installments.model';

const dateParts = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ValidationError({ message: 'Invalid date. Use YYYY-MM-DD.' });
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
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
  purchaseDate: string;
  firstDueDate: string;
  currencyCode: string;
  totalAmount: number;
  installmentCount: number;
}) {
  const account = await Accounts.findOne({ where: { id: input.accountId, userId: input.userId } });
  if (!account) throw new NotFoundError({ message: 'Credit card account not found.' });
  if (account.accountCategory !== ACCOUNT_CATEGORIES.credit_card) {
    throw new ValidationError({ message: 'Installment plans can only be created for credit card accounts.' });
  }
  if (account.currencyCode !== input.currencyCode) {
    throw new ValidationError({ message: 'The installment currency must match the credit card currency.' });
  }
  dateParts(input.purchaseDate);
  dateParts(input.firstDueDate);

  const total = await roundToCurrency({
    money: Money.fromDecimal(input.totalAmount),
    userId: input.userId,
    currencyCode: input.currencyCode,
    mode: 'half-up',
  });
  if (!total.isPositive()) throw new ValidationError({ message: 'Total amount must be greater than zero.' });

  const precision = await import('@common/lib/currency-precision');
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
    await CreditCardInstallments.bulkCreate(rows, { transaction });
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

export async function cancelInstallmentPlan({ userId, id }: { userId: number; id: string }) {
  const sequelize = CreditCardInstallmentPlans.sequelize;
  if (!sequelize) throw new Error('Credit card installment models are not initialized.');
  return sequelize.transaction(async (transaction) => {
    const plan = await CreditCardInstallmentPlans.findOne({
      where: { id, userId },
      include: [{ model: CreditCardInstallments, as: 'installments' }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!plan) throw new NotFoundError({ message: 'Installment plan not found.' });
    const installments = plan.installments ?? [];
    if (installments.some((item) => item.status === CREDIT_CARD_INSTALLMENT_STATUSES.posted)) {
      throw new ValidationError({
        message: 'A plan with posted installments cannot be cancelled. Reverse posted transactions first.',
      });
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
    }],
  });
  const reserved = Money.sum(
    plans.flatMap((plan) => plan.installments ?? []).map((installment) => Money.fromDecimal(installment.amount)),
  );
  // Match the existing credit-utilization widget semantics: manual cards track debt as
  // a negative balance; provider-synced accounts already include the credit limit.
  const balanceIncludesCreditLimit = account.type !== 'system';
  const used = balanceIncludesCreditLimit
    ? account.creditLimit.subtract(account.currentBalance).isPositive()
      ? account.creditLimit.subtract(account.currentBalance)
      : Money.zero()
    : account.currentBalance.isNegative()
      ? account.currentBalance.abs()
      : Money.zero();
  const available = account.creditLimit.subtract(used).subtract(reserved);
  return {
    accountId,
    creditLimit: account.creditLimit,
    currentBalance: account.currentBalance,
    usedCredit: used,
    reservedInstallments: reserved,
    availableCredit: available.isNegative() ? Money.zero() : available,
    overLimit: available.isNegative(),
  };
}
