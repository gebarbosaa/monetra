import { QueryInterface, QueryTypes, Transaction } from 'sequelize';

/**
 * Adds Luna, Thor and Both tags for existing accounts. The stable description
 * marker is consumed by the transaction form as the pet selector's identity;
 * the visible tag names remain editable and localized.
 */
module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    const transaction: Transaction = await queryInterface.sequelize.transaction();

    try {
      const users = await queryInterface.sequelize.query<{ id: number }>('SELECT id FROM "Users"', {
        type: QueryTypes.SELECT,
        transaction,
      });

      const existing = await queryInterface.sequelize.query<{
        userId: number;
        name: string;
        description: string | null;
      }>(
        'SELECT "userId", name, description FROM "Tags" WHERE name IN (\'Luna\', \'Thor\', \'Ambos\') OR description LIKE \'MONETRA_PET:%\'',
        { type: QueryTypes.SELECT, transaction },
      );

      const namesByUser = new Set(existing.map((tag) => `${tag.userId}:${tag.name}`));
      const markersByUser = new Set(existing.map((tag) => `${tag.userId}:${tag.description}`));
      const defaults = [
        { name: 'Luna', color: '#d97706', icon: 'cat', description: 'MONETRA_PET:luna' },
        { name: 'Thor', color: '#d97706', icon: 'dog', description: 'MONETRA_PET:thor' },
        { name: 'Ambos', color: '#d97706', icon: 'paw-print', description: 'MONETRA_PET:both' },
      ];
      const now = new Date();
      const inserts = users.flatMap((user) =>
        defaults
          .filter(
            (tag) =>
              !namesByUser.has(`${user.id}:${tag.name}`) &&
              !markersByUser.has(`${user.id}:${tag.description}`),
          )
          .map((tag) => ({
            userId: user.id,
            ...tag,
            createdAt: now,
            updatedAt: now,
          })),
      );

      if (inserts.length) {
        await queryInterface.bulkInsert('Tags', inserts, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  // Keep these tags on rollback: a user may already have used them on transactions.
  down: async (): Promise<void> => {},
};
