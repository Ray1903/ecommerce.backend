import { errors } from '@strapi/utils';

const { ApplicationError } = errors;
class ConflictError extends Error {}

export default {
  async registerCustomer(ctx) {
    const service = strapi.service('api::public-auth.public-auth');

    try {
      const result = await service.registerCustomer(ctx.request.body ?? {}, ctx);
      ctx.status = 201;
      ctx.body = result;
    } catch (error) {
      if (error instanceof ConflictError) {
        ctx.throw(409, error.message);
      }

      if (error instanceof ApplicationError) {
        throw error;
      }

      strapi.log.error('Error registering customer', error);
      throw new ApplicationError('No fue posible registrar el cliente');
    }
  },

  async registerSeller(ctx) {
    const service = strapi.service('api::public-auth.public-auth');

    try {
      const result = await service.registerSeller(ctx.request.body ?? {}, ctx);
      ctx.status = 201;
      ctx.body = result;
    } catch (error) {
      if (error instanceof ConflictError) {
        ctx.throw(409, error.message);
      }

      if (error instanceof ApplicationError) {
        throw error;
      }

      strapi.log.error('Error registering seller', error);
      throw new ApplicationError('No fue posible registrar la solicitud del seller');
    }
  },
};

export { ConflictError };
