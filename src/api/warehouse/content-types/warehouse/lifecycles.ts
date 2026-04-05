import { buildEntitySlug } from '../../../../utils/entity-identifiers';

const WAREHOUSE_UID = 'api::warehouse.warehouse';

export default {
  async afterCreate(event) {
    const warehouse = event.result;

    if (!warehouse?.id) {
      return;
    }

    const expectedSlug = buildEntitySlug(warehouse.name ?? '', warehouse.id);

    if (!expectedSlug || warehouse.slug === expectedSlug) {
      return;
    }

    await strapi.db.query(WAREHOUSE_UID).update({
      where: { id: warehouse.id },
      data: {
        slug: expectedSlug,
      },
    });
  },
};
