import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import Transactions from '@models/transactions.model';
import { Table, Column, Model, ForeignKey, BelongsTo, DataType } from 'sequelize-typescript';

import CreditCardInstallmentPlans from './credit-card-installment-plans.model';

export const CREDIT_CARD_INSTALLMENT_STATUSES = {
  planned: 'planned',
  posted: 'posted',
  cancelled: 'cancelled',
} as const;
type CreditCardInstallmentStatus =
  (typeof CREDIT_CARD_INSTALLMENT_STATUSES)[keyof typeof CREDIT_CARD_INSTALLMENT_STATUSES];

@Table({ tableName: 'CreditCardInstallments', timestamps: true, freezeTableName: true })
export default class CreditCardInstallments extends Model {
  @Column(IdColumn())
  declare id: string;

  @ForeignKey(() => CreditCardInstallmentPlans)
  @Column({ type: DataType.UUID, allowNull: false })
  planId!: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  installmentNumber!: number;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  dueDate!: string;

  @MoneyField()
  declare amount: Money;

  @MoneyField()
  declare refAmount: Money;

  @ForeignKey(() => Transactions)
  @Column({ type: DataType.UUID, allowNull: true })
  transactionId!: string | null;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: CREDIT_CARD_INSTALLMENT_STATUSES.planned })
  status!: CreditCardInstallmentStatus;

  @BelongsTo(() => CreditCardInstallmentPlans, { foreignKey: 'planId', onDelete: 'CASCADE' })
  plan!: CreditCardInstallmentPlans;

  @BelongsTo(() => Transactions, { foreignKey: 'transactionId', onDelete: 'SET NULL' })
  transaction!: Transactions | null;

  declare createdAt: Date;
  declare updatedAt: Date;
}
