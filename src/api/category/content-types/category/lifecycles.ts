import { buildEntitySlug } from '../../../../utils/entity-identifiers';

const CATEGORY_UID = 'api::category.category';

export default {
  async afterCreate(event) {
    const category = event.result;

    if (!category?.id) {
      return;
    }

    const expectedSlug = buildEntitySlug(category.name ?? '', category.id);

    if (!expectedSlug || category.slug === expectedSlug) {
      return;
    }

    await strapi.db.query(CATEGORY_UID).update({
      where: { id: category.id },
      data: {
        slug: expectedSlug,
      },
    });
  },
};
