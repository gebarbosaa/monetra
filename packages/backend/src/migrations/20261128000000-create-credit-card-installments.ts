import { DataTypes, QueryInterface, Transaction } from 'sequelize';

module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.createTable(
        'CreditCardInstallmentPlans',
        {
          id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
          userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          accountId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'Accounts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          description: { type: DataTypes.STRING(200), allowNull: false },
          purchaseDate: { type: DataTypes.DATEONLY, allowNull: false },
          currencyCode: { type: DataTypes.STRING(20), allowNull: false },
          totalAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
          refTotalAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
          installmentCount: { type: DataTypes.INTEGER, allowNull: false },
          status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
          createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
          updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        },
        { transaction: t },
      );

      await queryInterface.createTable(
        'CreditCardInstallments',
        {
          id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
          planId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'CreditCardInstallmentPlans', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          installmentNumber: { type: DataTypes.INTEGER, allowNull: false },
          dueDate: { type: DataTypes.DATEONLY, allowNull: false },
          amount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
          refAmount: { type: DataTypes.DECIMAL(36, 18), allowNull: false },
          transactionId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'Transactions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
          status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'planned' },
          createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
          updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        },
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "CreditCardInstallmentPlans"
         ADD CONSTRAINT "credit_card_installment_plans_count_chk"
           CHECK ("installmentCount" BETWEEN 2 AND 48),
         ADD CONSTRAINT "credit_card_installment_plans_total_chk"
           CHECK ("totalAmount" > 0 AND "refTotalAmount" >= 0),
         ADD CONSTRAINT "credit_card_installment_plans_status_chk"
           CHECK ("status" IN ('active', 'cancelled'));`,
        { transaction: t },
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE "CreditCardInstallments"
         ADD CONSTRAINT "credit_card_installments_number_chk"
           CHECK ("installmentNumber" >= 1),
         ADD CONSTRAINT "credit_card_installments_amount_chk"
           CHECK ("amount" > 0 AND "refAmount" >= 0),
         ADD CONSTRAINT "credit_card_installments_status_chk"
           CHECK ("status" IN ('planned', 'posted', 'cancelled'));`,
        { transaction: t },
      );

      await queryInterface.addIndex('CreditCardInstallmentPlans', ['userId', 'accountId', 'status'], {
        name: 'credit_card_installment_plans_owner_account_status_idx',
        transaction: t,
      });
      await queryInterface.addIndex('CreditCardInstallments', ['planId', 'installmentNumber'], {
        name: 'credit_card_installments_plan_number_uq',
        unique: true,
        transaction: t,
      });
      await queryInterface.addIndex('CreditCardInstallments', ['dueDate', 'status'], {
        name: 'credit_card_installments_due_status_idx',
        transaction: t,
      });
      await queryInterface.addIndex('CreditCardInstallments', ['transactionId'], {
        name: 'credit_card_installments_transaction_uq',
        unique: true,
        where: { transactionId: { [require('sequelize').Op.ne]: null } },
        transaction: t,
      });

      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface): Promise<void> => {
    const t: Transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable('CreditCardInstallments', { transaction: t });
      await queryInterface.dropTable('CreditCardInstallmentPlans', { transaction: t });
      await t.commit();
    } catch (error) {
      await t.rollback();
      throw error;
    }
  },
};
