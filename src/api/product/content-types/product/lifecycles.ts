import { buildEntitySlug, buildProductSku } from '../../../../utils/entity-identifiers';

const PRODUCT_UID = 'api::product.product';

export default {
  async afterCreate(event) {
    const product = event.result;

    if (!product?.id) {
      return;
    }

    const updateData: Record<string, string> = {};
    const expectedSlug = buildEntitySlug(product.name ?? '', product.id);

    if (expectedSlug && product.slug !== expectedSlug) {
      updateData.slug = expectedSlug;
    }

    if (!product.sku) {
      updateData.sku = buildProductSku(product.id);
    }

    if (!Object.keys(updateData).length) {
      return;
    }

    await strapi.db.query(PRODUCT_UID).update({
      where: { id: product.id },
      data: updateData,
    });
  },
};
