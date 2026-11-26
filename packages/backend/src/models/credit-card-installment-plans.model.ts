import { CURRENCY_CODE_MAX_LENGTH } from '@common/lib/currency-code-columns';
import { IdColumn } from '@common/types/id-column';
import { Money } from '@common/types/money';
import { MoneyField } from '@common/types/money-column';
import Accounts from '@models/accounts.model';
import Users from '@models/users.model';
import { Table, Column, Model, ForeignKey, BelongsTo, HasMany, DataType } from 'sequelize-typescript';

import CreditCardInstallments from './credit-card-installments.model';

export const CREDIT_CARD_INSTALLMENT_PLAN_STATUSES = {
  active: 'active',
  cancelled: 'cancelled',
} as const;
export type CreditCardInstallmentPlanStatus =
  (typeof CREDIT_CARD_INSTALLMENT_PLAN_STATUSES)[keyof typeof CREDIT_CARD_INSTALLMENT_PLAN_STATUSES];

@Table({ tableName: 'CreditCardInstallmentPlans', timestamps: true, freezeTableName: true })
export default class CreditCardInstallmentPlans extends Model {
  @Column(IdColumn())
  declare id: string;

  @ForeignKey(() => Users)
  @Column({ type: DataType.INTEGER, allowNull: false })
  userId!: number;

  @ForeignKey(() => Accounts)
  @Column({ type: DataType.UUID, allowNull: false })
  accountId!: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  description!: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  purchaseDate!: string;

  @Column({ type: DataType.STRING(CURRENCY_CODE_MAX_LENGTH), allowNull: false })
  currencyCode!: string;

  @MoneyField()
  declare totalAmount: Money;

  @MoneyField()
  declare refTotalAmount: Money;

  @Column({ type: DataType.INTEGER, allowNull: false })
  installmentCount!: number;

  @Column({ type: DataType.STRING(20), allowNull: false, defaultValue: CREDIT_CARD_INSTALLMENT_PLAN_STATUSES.active })
  status!: CreditCardInstallmentPlanStatus;

  @BelongsTo(() => Users, { foreignKey: 'userId' })
  user!: Users;

  @BelongsTo(() => Accounts, { foreignKey: 'accountId' })
  account!: Accounts;

  @HasMany(() => CreditCardInstallments, { foreignKey: 'planId' })
  installments!: CreditCardInstallments[];

  declare createdAt: Date;
  declare updatedAt: Date;
}
