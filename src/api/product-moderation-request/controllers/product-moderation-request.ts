import { factories } from '@strapi/strapi';

const REQUEST_UID = 'api::product-moderation-request.product-moderation-request';
const PRODUCT_UID = 'api::product.product';

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const getProductResolutionState = (requestType: string, action: string) => {
  if (action === 'reject') {
    return {
      moderationStatus: 'rejected',
      isActive: false,
    };
  }

  if (requestType === 'deactivation') {
    return {
      moderationStatus: 'deactivated',
      isActive: false,
    };
  }

  return {
    moderationStatus: 'active',
    isActive: true,
  };
};

export default factories.createCoreController(
  'api::product-moderation-request.product-moderation-request' as any,
  () => ({
    async adminList(ctx) {
      const where: Record<string, any> = {};
      const status =
        typeof ctx.query?.status === 'string' ? ctx.query.status.trim() : '';
      const type = typeof ctx.query?.type === 'string' ? ctx.query.type.trim() : '';

      if (status) {
        where.status = status;
      }

      if (type) {
        where.type = type;
      }

      const requests = await strapi.db.query(REQUEST_UID).findMany({
        where,
        populate: {
          product: true,
          seller: true,
          reviewedBy: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      ctx.body = {
        data: requests,
        meta: {
          total: requests.length,
        },
      };
    },

    async resolve(ctx) {
      const requestId = parsePositiveInteger(ctx.params?.id);
      if (!requestId) {
        return ctx.badRequest('El id de la solicitud es invalido');
      }

      const payload = ctx.request.body?.data ?? ctx.request.body ?? {};
      const action = typeof payload.action === 'string' ? payload.action.trim() : '';
      const resolutionNotes =
        typeof payload.resolutionNotes === 'string'
          ? payload.resolutionNotes.trim()
          : '';

      if (!['approve', 'reject'].includes(action)) {
        return ctx.badRequest('El campo action debe ser approve o reject');
      }

      const request = await strapi.db.query(REQUEST_UID).findOne({
        where: { id: requestId },
        populate: {
          product: true,
        },
      });

      if (!request) {
        return ctx.notFound('Solicitud no encontrada');
      }

      if (request.status !== 'pending') {
        return ctx.badRequest('La solicitud ya fue resuelta');
      }

      const resolutionState = getProductResolutionState(request.type, action);

      await strapi.db.transaction(async ({ trx }) => {
        await (strapi.db.query(PRODUCT_UID) as any).update({
          where: { id: request.product.id },
          data: resolutionState,
          transaction: trx,
        });

        await (strapi.db.query(REQUEST_UID) as any).update({
          where: { id: request.id },
          data: {
            status: action === 'approve' ? 'approved' : 'rejected',
            resolutionNotes: resolutionNotes || null,
            reviewedAt: new Date(),
            reviewedBy: ctx.state?.user?.id ?? null,
          },
          transaction: trx,
        });
      });

      const updatedRequest = await strapi.db.query(REQUEST_UID).findOne({
        where: { id: request.id },
        populate: {
          product: true,
          seller: true,
          reviewedBy: true,
        },
      });

      ctx.body = {
        message: 'Solicitud resuelta correctamente',
        request: updatedRequest,
      };
    },
  })
);
