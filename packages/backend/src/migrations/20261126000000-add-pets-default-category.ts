import { QueryInterface } from 'sequelize';

/**
 * Adds the Brazil-first Pets category to existing users without replacing or
 * modifying any category they already have. The stable keys make the migration
 * safe to run for users who already received the category through signup.
 */
module.exports = {
  up: async (queryInterface: QueryInterface): Promise<void> => {
    await queryInterface.sequelize.query(`
      INSERT INTO "Categories" ("name", "key", "icon", "color", "type", "userId")
      SELECT 'Pets', 'pets', 'animal-dog-20-filled', '#d97706', 'custom', u."id"
        FROM "Users" AS u
       WHERE NOT EXISTS (
         SELECT 1
           FROM "Categories" AS existing
          WHERE existing."userId" = u."id"
            AND existing."key" = 'pets'
            AND existing."parentId" IS NULL
       );

      INSERT INTO "Categories" ("name", "key", "icon", "color", "type", "parentId", "userId")
      SELECT child.name, child.key, child.icon, '#d97706', 'custom', parent."id", parent."userId"
        FROM "Categories" AS parent
        CROSS JOIN (VALUES
          ('Alimentação', 'food', 'food-20-filled'),
          ('Veterinário', 'veterinary', 'stethoscope-20-filled'),
          ('Medicamentos', 'medication', 'pill-20-filled'),
          ('Higiene', 'hygiene', 'sparkle-20-filled'),
          ('Acessórios', 'accessories', 'shopping-bag-20-filled'),
          ('Banho e tosa', 'grooming', 'sparkle-20-filled')
        ) AS child(name, key, icon)
       WHERE parent."key" = 'pets'
         AND parent."parentId" IS NULL
         AND NOT EXISTS (
           SELECT 1
             FROM "Categories" AS existing
            WHERE existing."userId" = parent."userId"
              AND existing."parentId" = parent."id"
              AND existing."key" = child.key
         );
    `);
  },

  // Intentionally non-reversible: users may have already attached transactions to
  // these categories, so deleting them during rollback would destroy user data.
  down: async (): Promise<void> => {},
};
