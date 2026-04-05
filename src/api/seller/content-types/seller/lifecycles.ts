import { buildEntitySlug } from '../../../../utils/entity-identifiers';

const SELLER_UID = 'api::seller.seller';

export default {
  async afterCreate(event) {
    const seller = event.result;

    if (!seller?.id) {
      return;
    }

    const expectedSlug = buildEntitySlug(seller.storeName ?? '', seller.id);

    if (!expectedSlug || seller.slug === expectedSlug) {
      return;
    }

    await strapi.db.query(SELLER_UID).update({
      where: { id: seller.id },
      data: {
        slug: expectedSlug,
      },
    });
  },
};
