import type { Core } from '@strapi/strapi';

const PUBLIC_ROLE_UID = 'plugin::users-permissions.role';

const REQUIRED_ROLES = [
  {
    name: 'customer',
    type: 'customer',
    description: 'Comprador de la plataforma',
  },
  {
    name: 'seller',
    type: 'seller',
    description: 'Vendedor pendiente o aprobado para operar en la plataforma',
  },
  {
    name: 'delivery',
    type: 'delivery',
    description: 'Repartidor de la plataforma',
  },
  {
    name: 'operations',
    type: 'operations',
    description: 'Operaciones internas para asignacion logistica y seguimiento',
  },
];

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    for (const roleData of REQUIRED_ROLES) {
      const existingRole = await strapi.db.query(PUBLIC_ROLE_UID).findOne({
        where: { type: roleData.type },
      });

      if (!existingRole) {
        await strapi.db.query(PUBLIC_ROLE_UID).create({
          data: roleData,
        });
      }
    }
  },
};
