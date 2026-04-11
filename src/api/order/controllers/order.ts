import { factories } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user';
const PRODUCT_UID = 'api::product.product';
const ORDER_UID = 'api::order.order';
const ORDER_ITEM_UID = 'api::order-item.order-item';
const ADRESS_UID = 'api::adress.adress';

const parsePositiveNumber = (value: unknown) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseOptionalNonNegativeNumber = (
  value: unknown,
  fallback = 0
) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const sanitizeCheckoutPayload = (payload: Record<string, any> = {}) => {
  const items = Array.isArray(payload.items) ? payload.items : null;
  const adressId = Number(payload.adressId);
  const deliveryFee = parseOptionalNonNegativeNumber(payload.deliveryFee, 0);
  const notes =
    typeof payload.notes === 'string' && payload.notes.trim()
      ? payload.notes.trim()
      : null;

  if (!items || items.length === 0) {
    throw new Error('El campo items es requerido y debe contener al menos un producto');
  }

  if (!Number.isInteger(adressId) || adressId <= 0) {
    throw new Error('El campo adressId es requerido');
  }

  if (deliveryFee === null) {
    throw new Error('El campo deliveryFee debe ser numerico y no negativo');
  }

  if (payload.promoCode || payload.discount !== undefined) {
    throw new Error('Descuentos no habilitados en esta version');
  }

  const normalizedItems = items.map((item: Record<string, unknown>, index: number) => {
    const productId = Number(item?.productId);
    const quantity = parsePositiveNumber(item?.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw new Error(`items[${index}].productId es invalido`);
    }

    if (quantity === null) {
      throw new Error(`items[${index}].quantity debe ser mayor a 0`);
    }

    return {
      productId,
      quantity,
    };
  });

  return {
    adressId,
    deliveryFee,
    notes,
    items: normalizedItems,
  };
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveCustomerUser = async (ctx) => {
  const authUser = ctx.state?.user;

  if (!authUser?.id) {
    ctx.unauthorized('Debes iniciar sesion');
    return null;
  }

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: authUser.id },
    populate: {
      role: true,
    },
  });

  if (user?.role?.type !== 'customer') {
    ctx.forbidden('El usuario autenticado no tiene permisos de customer');
    return null;
  }

  return user;
};

export default factories.createCoreController('api::order.order', () => ({
  async checkout(ctx) {
    const customerUser = await resolveCustomerUser(ctx);
    if (!customerUser) return;

    let payload;

    try {
      payload = sanitizeCheckoutPayload(ctx.request.body?.data ?? ctx.request.body ?? {});
    } catch (error) {
      return ctx.badRequest(error.message || 'Payload de checkout invalido');
    }

    const adress = await strapi.db.query(ADRESS_UID).findOne({
      where: {
        id: payload.adressId,
        user: customerUser.id,
      },
    });

    if (!adress) {
      return ctx.badRequest('La direccion no existe o no pertenece al customer');
    }

    const productIds = Array.from(new Set(payload.items.map((item) => item.productId)));
    const products = await strapi.db.query(PRODUCT_UID).findMany({
      where: {
        id: { $in: productIds },
      },
      populate: {
        seller: true,
      },
    });

    const productById = new Map(products.map((product) => [product.id, product]));
    const stockErrors = [];
    let subtotal = 0;

    const orderItemsPayload = payload.items.map((item) => {
      const product = productById.get(item.productId);

      if (!product) {
        stockErrors.push({
          productId: item.productId,
          reason: 'Producto no encontrado',
        });
        return null;
      }

      const currentStock = toNumber(product.stock, 0);
      const isModerationSellable =
        !product.moderationStatus || product.moderationStatus === 'active';

      if (!product.isActive || !isModerationSellable) {
        stockErrors.push({
          productId: item.productId,
          reason: 'Producto no disponible para venta',
        });
        return null;
      }

      if (currentStock < item.quantity) {
        stockErrors.push({
          productId: item.productId,
          reason: 'Stock insuficiente',
          availableStock: currentStock,
          requestedQty: item.quantity,
        });
        return null;
      }

      const unitPrice = toNumber(product.price, 0);
      const itemSubtotal = Number((unitPrice * item.quantity).toFixed(2));
      subtotal += itemSubtotal;

      return {
        product,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: itemSubtotal,
      };
    });

    if (stockErrors.length) {
      ctx.status = 409;
      ctx.body = {
        message: 'No fue posible completar la compra por validaciones de stock/producto',
        errors: stockErrors,
      };
      return;
    }

    const total = Number((subtotal + payload.deliveryFee).toFixed(2));
    const orderNumber = `ORD-${Date.now()}-${customerUser.id}`;

    let createdOrder;

    await strapi.db.transaction(async ({ trx }) => {
      createdOrder = await (strapi.db.query(ORDER_UID) as any).create({
        data: {
          statusOrder: 'pending',
          payment_status: 'pending',
          subtotal,
          deliveryFee: payload.deliveryFee,
          total,
          notes: payload.notes,
          adress: payload.adressId,
          customer: customerUser.id,
          orderNumber,
        },
        transaction: trx,
      });

      for (const item of orderItemsPayload) {
        if (!item) continue;

        await (strapi.db.query(ORDER_ITEM_UID) as any).create({
          data: {
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
            productNameSnapshot: item.product.name,
            unitSnapshot: item.product.unit ?? null,
            product: item.product.id,
            seller: item.product.seller?.id ?? null,
            order: createdOrder.id,
          },
          transaction: trx,
        });

        await (strapi.db.query(PRODUCT_UID) as any).update({
          where: { id: item.product.id },
          data: {
            stock: Number((toNumber(item.product.stock, 0) - item.quantity).toFixed(2)),
          },
          transaction: trx,
        });
      }
    });

    const order = await strapi.db.query(ORDER_UID).findOne({
      where: { id: createdOrder.id },
      populate: {
        items: {
          populate: {
            product: true,
            seller: true,
          },
        },
        adress: true,
        customer: true,
      },
    });

    ctx.status = 201;
    ctx.body = {
      message: 'Orden creada correctamente',
      order,
    };
  },
}));
