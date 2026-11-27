import type { DeleteTrashResponse } from '@bt/shared/types';
import TransactionGroupItems from '@models/transaction-group-items.model';
import CreditCardInstallments from '@models/credit-card-installments.model';
import { ValidationError } from '@js/errors';
import { dissolveUndersizedGroups } from '@models/transaction-groups.model';
import { destroyTransactions } from '@models/transactions-query';
import { trashedWhere } from '@models/transactions-query/deletion-where';
import { withTransaction } from '@services/common/with-transaction';
import { Op } from 'sequelize';

import { loadTrashedLegs } from './load-trashed-legs';

/**
 * Hard-deletes exactly these trashed rows, without authorization or twin expansion. Hooks stay
 * off: trashing already took the balance back. Children cascade.
 */
export const destroyTrashedRows = async ({ transactionIds }: { transactionIds: string[] }) => {
  if (!transactionIds.length) return;

  const linkedInstallments = await CreditCardInstallments.findAll({
    where: { transactionId: { [Op.in]: transactionIds } },
    attributes: ['transactionId'],
  });
  if (linkedInstallments.length) {
    throw new ValidationError({
      message:
        'Transactions linked to credit-card installments cannot be permanently deleted from Trash. Manage them through the installment plan.',
      details: { transactionIds: linkedInstallments.map((link) => link.transactionId) },
    });
  }

  const groupItems = await TransactionGroupItems.findAll({
    where: { transactionId: { [Op.in]: transactionIds } },
    attributes: ['groupId'],
  });

  await destroyTransactions({
    where: { id: { [Op.in]: transactionIds }, ...trashedWhere },
    planned: 'include',
    access: 'unscoped-internal',
    balanceAdjustments: 'include',
    hooks: false,
  });
  await dissolveUndersizedGroups({ groupIds: [...new Set(groupItems.map((item) => item.groupId))] });
};

export const deleteTrashed = withTransaction(
  async ({ userId, transactionIds }: { userId: number; transactionIds: string[] }): Promise<DeleteTrashResponse> => {
    const legIds = (await loadTrashedLegs({ userId, transactionIds })).map((leg) => leg.id);
    await destroyTrashedRows({ transactionIds: legIds });
    return { deletedIds: legIds };
  },
);
