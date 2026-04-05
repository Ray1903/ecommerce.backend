import { factories } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user';
const PRODUCT_UID = 'api::product.product';
const DELIVERY_REQUEST_UID = 'api::delivery-request.delivery-request';
const SELLER_UID = 'api::seller.seller';
const WAREHOUSE_UID = 'api::warehouse.warehouse';

const DEFAULT_PENDING_WAREHOUSE_MESSAGE =
  'Estamos validando el punto de recepcion ideal para tu zona';
const DEFAULT_PENDING_DELIVERY_INSTRUCTIONS =
  'Nuestro equipo te contactara para indicarte a que almacen entregar';

const getAuthenticatedSeller = async (ctx) => {
  const authUser = ctx.state?.user;

  if (!authUser?.id) {
    ctx.unauthorized('Debes iniciar sesion');
    return null;
  }

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: authUser.id },
    populate: {
      seller: {
        populate: {
          assignedWarehouse: true,
          profileImage: true,
        },
      },
      role: true,
    },
  });

  if (user?.role?.type !== 'seller') {
    ctx.forbidden('El usuario autenticado no tiene permisos de seller');
    return null;
  }

  if (!user?.seller) {
    ctx.forbidden('El usuario no tiene un perfil de seller');
    return null;
  }

  return { user, seller: user.seller };
};

const ensureApprovedSeller = (ctx, seller) => {
  if (seller.approvalStatus !== 'approved') {
    ctx.forbidden('El seller debe estar aprobado para gestionar productos');
    return false;
  }

  return true;
};

const sanitizeAddress = (value: Record<string, any> = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const address = {
    addressLine1:
      typeof value.addressLine1 === 'string' ? value.addressLine1.trim() : '',
    addressLine2:
      typeof value.addressLine2 === 'string' ? value.addressLine2.trim() : '',
    city: typeof value.city === 'string' ? value.city.trim() : '',
    state: typeof value.state === 'string' ? value.state.trim() : '',
    postalCode:
      typeof value.postalCode === 'string' ? value.postalCode.trim() : '',
    reference:
      typeof value.reference === 'string' ? value.reference.trim() : '',
  };

  return Object.values(address).some(Boolean) ? address : null;
};

const sanitizeSellerProfilePayload = (payload: Record<string, any> = {}) => {
  const storeName =
    typeof payload.storeName === 'string' ? payload.storeName.trim() : '';
  const contactPhone =
    typeof payload.contactPhone === 'string' ? payload.contactPhone.trim() : '';

  if (!storeName) {
    throw new Error('El campo storeName es requerido');
  }

  if (!contactPhone) {
    throw new Error('El campo contactPhone es requerido');
  }

  return {
    storeName,
    contactPhone,
    address: sanitizeAddress(payload.address ?? {}),
  };
};

const sanitizeRelationIdArray = (value: unknown, fieldName: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`El campo ${fieldName} debe ser un arreglo de ids`);
  }

  const ids = value.map((item) => Number(item));

  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error(`El campo ${fieldName} debe contener ids validos`);
  }

  return ids;
};

const sanitizeProductPayload = (payload: Record<string, any> = {}) => {
  const hasImages = Object.prototype.hasOwnProperty.call(payload, 'images');
  const data = {
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
    description: payload.description ?? null,
    sku: typeof payload.sku === 'string' ? payload.sku.trim() : null,
    price: payload.price,
    unit: payload.unit ?? null,
    minOrderQty: payload.minOrderQty ?? null,
    stock: payload.stock ?? 0,
    category: payload.category ?? null,
    images: hasImages ? sanitizeRelationIdArray(payload.images, 'images') : undefined,
  };

  if (!data.name) {
    throw new Error('El campo name es requerido');
  }

  if (data.price === undefined || data.price === null || Number.isNaN(Number(data.price))) {
    throw new Error('El campo price es requerido y debe ser numerico');
  }

  if (data.stock === undefined || data.stock === null || Number.isNaN(Number(data.stock))) {
    throw new Error('El campo stock debe ser numerico');
  }

  if (Number(data.stock) < 0) {
    throw new Error('El campo stock no puede ser negativo');
  }

  const { images, ...baseData } = data;

  return {
    ...baseData,
    ...(images !== undefined ? { images } : {}),
    price: Number(baseData.price),
    minOrderQty:
      baseData.minOrderQty === null ||
      baseData.minOrderQty === undefined ||
      baseData.minOrderQty === ''
        ? null
        : Number(baseData.minOrderQty),
    stock:
      baseData.stock === null || baseData.stock === undefined || baseData.stock === ''
        ? 0
        : Number(baseData.stock),
  };
};

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const buildWarehouseSummary = (seller) => {
  const warehouse = seller.assignedWarehouse;

  if (!warehouse) {
    return null;
  }

  return {
    id: warehouse.id,
    documentId: warehouse.documentId,
    name: warehouse.name,
    address: warehouse.address ?? null,
  };
};

const buildSellerSummary = async (seller) => {
  const productCount = await strapi.db.query(PRODUCT_UID).count({
    where: { seller: seller.id },
  });

  return {
    id: seller.id,
    documentId: seller.documentId,
    storeName: seller.storeName,
    approvalStatus: seller.approvalStatus,
    contactPhone: seller.contactPhone,
    address: sanitizeAddress(seller.address ?? {}) ?? {
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      reference: '',
    },
    productCount,
    assignedWarehouse: buildWarehouseSummary(seller),
    warehouseAssignmentStatus: seller.warehouseAssignmentStatus ?? 'pending',
    deliveryInstructions: seller.deliveryInstructions ?? null,
  };
};

export default factories.createCoreController('api::seller.seller', () => ({
  async me(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;

    ctx.body = {
      seller: await buildSellerSummary(auth.seller),
    };
  },

  async updateProfile(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;

    try {
      const data = sanitizeSellerProfilePayload(
        ctx.request.body?.data ?? ctx.request.body ?? {}
      );

      const seller = await strapi.db.query(SELLER_UID).update({
        where: { id: auth.seller.id },
        data,
        populate: {
          assignedWarehouse: true,
          profileImage: true,
        },
      });

      ctx.body = {
        message: 'Perfil actualizado correctamente',
        seller: await buildSellerSummary(seller),
      };
    } catch (error) {
      ctx.badRequest(error.message || 'No fue posible actualizar el perfil');
    }
  },

  async dashboard(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;

    const sellerSummary = await buildSellerSummary(auth.seller);

    ctx.body = {
      seller: {
        storeName: sellerSummary.storeName,
        approvalStatus: sellerSummary.approvalStatus,
        productCount: sellerSummary.productCount,
      },
      warehouse: {
        assignmentStatus: sellerSummary.warehouseAssignmentStatus,
        name: sellerSummary.assignedWarehouse?.name ?? null,
        deliveryInstructions:
          sellerSummary.deliveryInstructions ??
          DEFAULT_PENDING_DELIVERY_INSTRUCTIONS,
      },
      actions: {
        canCreateProducts: auth.seller.approvalStatus === 'approved',
        canDeliverToWarehouse:
          auth.seller.approvalStatus === 'approved' &&
          auth.seller.warehouseAssignmentStatus === 'assigned',
        canEditProfile: true,
      },
    };
  },

  async products(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;

    const products = await strapi.db.query(PRODUCT_UID).findMany({
      where: {
        seller: auth.seller.id,
      },
      populate: {
        category: true,
        images: true,
        seller: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    ctx.body = {
      data: products,
      items: products,
      meta: {
        total: products.length,
      },
    };
  },

  async createProduct(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;
    if (!ensureApprovedSeller(ctx, auth.seller)) return;

    try {
      const data = sanitizeProductPayload(ctx.request.body?.data ?? ctx.request.body ?? {});

      const product = await strapi.db.query(PRODUCT_UID).create({
        data: {
          ...data,
          seller: auth.seller.id,
        },
        populate: {
          category: true,
          images: true,
          seller: true,
        },
      });

      ctx.status = 201;
      ctx.body = product;
    } catch (error) {
      ctx.badRequest(error.message || 'No fue posible crear el producto');
    }
  },

  async updateProduct(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;
    if (!ensureApprovedSeller(ctx, auth.seller)) return;

    const productId = Number(ctx.params?.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return ctx.badRequest('El id del producto es invalido');
    }

    const existingProduct = await strapi.db.query(PRODUCT_UID).findOne({
      where: {
        id: productId,
        seller: auth.seller.id,
      },
    });

    if (!existingProduct) {
      return ctx.notFound('Producto no encontrado');
    }

    try {
      const data = sanitizeProductPayload(ctx.request.body?.data ?? ctx.request.body ?? {});

      const product = await strapi.db.query(PRODUCT_UID).update({
        where: { id: productId },
        data,
        populate: {
          category: true,
          images: true,
          seller: true,
        },
      });

      ctx.body = product;
    } catch (error) {
      ctx.badRequest(error.message || 'No fue posible actualizar el producto');
    }
  },

  async toggleActive(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;
    if (!ensureApprovedSeller(ctx, auth.seller)) return;

    const productId = Number(ctx.params?.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return ctx.badRequest('El id del producto es invalido');
    }

    const existingProduct = await strapi.db.query(PRODUCT_UID).findOne({
      where: {
        id: productId,
        seller: auth.seller.id,
      },
      populate: {
        category: true,
        images: true,
        seller: true,
      },
    });

    if (!existingProduct) {
      return ctx.notFound('Producto no encontrado');
    }

    const product = await strapi.db.query(PRODUCT_UID).update({
      where: { id: productId },
      data: {
        isActive: !existingProduct.isActive,
      },
      populate: {
        category: true,
        images: true,
        seller: true,
      },
    });

    ctx.body = product;
  },

  async warehouseAssignment(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;

    const warehouse = buildWarehouseSummary(auth.seller);

    if (!warehouse) {
      ctx.body = {
        status: auth.seller.warehouseAssignmentStatus ?? 'pending',
        warehouse: null,
        message: DEFAULT_PENDING_WAREHOUSE_MESSAGE,
      };
      return;
    }

    ctx.body = {
      status: auth.seller.warehouseAssignmentStatus,
      warehouse,
      deliveryInstructions:
        auth.seller.deliveryInstructions ?? DEFAULT_PENDING_DELIVERY_INSTRUCTIONS,
    };
  },

  async createDeliveryRequest(ctx) {
    const auth = await getAuthenticatedSeller(ctx);
    if (!auth) return;

    const payload = ctx.request.body?.data ?? ctx.request.body ?? {};
    const notes =
      typeof payload.notes === 'string' ? payload.notes.trim() : '';

    const deliveryRequest = await strapi.db.query(DELIVERY_REQUEST_UID).create({
      data: {
        notes: notes || null,
        status: 'received',
        seller: auth.seller.id,
      },
    });

    ctx.status = 201;
    ctx.body = {
      message: 'Tu solicitud fue enviada al equipo de operaciones',
      status: deliveryRequest.status,
    };
  },

  async adminLogistics(ctx) {
    const sellerId = parsePositiveInteger(ctx.params?.id);
    if (!sellerId) {
      return ctx.badRequest('El id del seller es invalido');
    }

    const seller = await strapi.db.query(SELLER_UID).findOne({
      where: { id: sellerId },
      populate: {
        assignedWarehouse: true,
      },
    });

    if (!seller) {
      return ctx.notFound('Seller no encontrado');
    }

    ctx.body = {
      seller: {
        id: seller.id,
        documentId: seller.documentId,
        storeName: seller.storeName,
        approvalStatus: seller.approvalStatus,
        contactPhone: seller.contactPhone,
        address: sanitizeAddress(seller.address ?? {}) ?? {
          addressLine1: '',
          addressLine2: '',
          city: '',
          state: '',
          postalCode: '',
          reference: '',
        },
      },
      warehouseAssignmentStatus: seller.warehouseAssignmentStatus ?? 'pending',
      suggestedWarehouse: buildWarehouseSummary(seller),
    };
  },

  async assignWarehouse(ctx) {
    const sellerId = parsePositiveInteger(ctx.params?.id);
    if (!sellerId) {
      return ctx.badRequest('El id del seller es invalido');
    }

    const payload = ctx.request.body?.data ?? ctx.request.body ?? {};
    const warehouseId = parsePositiveInteger(payload.warehouseId);
    const deliveryInstructions =
      typeof payload.deliveryInstructions === 'string'
        ? payload.deliveryInstructions.trim()
        : '';

    if (!warehouseId) {
      return ctx.badRequest('El campo warehouseId es requerido');
    }

    const [seller, warehouse] = await Promise.all([
      strapi.db.query(SELLER_UID).findOne({
        where: { id: sellerId },
      }),
      strapi.db.query(WAREHOUSE_UID).findOne({
        where: { id: warehouseId },
      }),
    ]);

    if (!seller) {
      return ctx.notFound('Seller no encontrado');
    }

    if (!warehouse) {
      return ctx.notFound('Warehouse no encontrado');
    }

    const updatedSeller = await strapi.db.query(SELLER_UID).update({
      where: { id: sellerId },
      data: {
        assignedWarehouse: warehouse.id,
        warehouseAssignmentStatus: 'assigned',
        deliveryInstructions: deliveryInstructions || null,
      },
      populate: {
        assignedWarehouse: true,
      },
    });

    ctx.body = {
      message: 'Almacen asignado correctamente',
      assignment: {
        status: updatedSeller.warehouseAssignmentStatus,
        warehouse: buildWarehouseSummary(updatedSeller),
        deliveryInstructions: updatedSeller.deliveryInstructions ?? null,
      },
    };
  },
}));
