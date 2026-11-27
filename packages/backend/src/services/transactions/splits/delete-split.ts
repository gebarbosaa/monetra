import { findOrThrowNotFound } from '@common/utils/find-or-throw-not-found';
import { t } from '@i18n/index';
import { ValidationError } from '@js/errors';
import RefundTransactions from '@models/refund-transactions.model';
import CreditCardInstallments from '@models/credit-card-installments.model';
import * as TransactionSplits from '@models/transaction-splits.model';
import Transactions from '@models/transactions.model';

import { withTransaction } from '../../common/with-transaction';

interface DeleteSplitParams {
  splitId: string;
  userId: number;
}

/**
 * Deletes a single split from a transaction.
 * The split's amount will be returned to the primary category.
 *
 * Rules:
 * 1. Split must exist and belong to the user
 * 2. Split cannot be deleted if it has refunds targeting it
 */
export const deleteSplit = withTransaction(async ({ splitId, userId }: DeleteSplitParams) => {
  const split = await findOrThrowNotFound({
    query: TransactionSplits.getSplitById({ id: splitId, userId }),
    message: t({ key: 'transactions.splits.splitNotFound' }),
  });

  const linkedInstallment = await CreditCardInstallments.findOne({
    where: { transactionId: split.transactionId },
    attributes: ['id'],
  });
  if (linkedInstallment) {
    throw new ValidationError({
      message:
        'A split belonging to a credit-card installment transaction cannot be deleted directly. Manage it through the installment plan.',
    });
  }

  // Check if any refunds target this split
  const refundTargetingSplit = await RefundTransactions.findOne({
    where: { splitId, userId },
    include: [{ model: Transactions, as: 'refundTransaction', required: true, attributes: [] }],
  });

  if (refundTargetingSplit) {
    throw new ValidationError({
      message: t({ key: 'transactions.splits.cannotDeleteWithRefunds' }),
    });
  }

  await TransactionSplits.deleteSplitById({ id: splitId, userId });

  return { deleted: true };
});
