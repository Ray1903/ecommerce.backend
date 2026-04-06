import { errors } from '@strapi/utils';

const { ApplicationError, ValidationError } = errors;

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

  async login(ctx) {
    const service = strapi.service('api::public-auth.public-auth');

    try {
      const result = await service.login(ctx.request.body ?? {}, ctx);
      ctx.status = 200;
      ctx.body = result;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ApplicationError) {
        throw error;
      }

      strapi.log.error('Error during login', error);
      throw new ApplicationError('No fue posible iniciar sesión');
    }
  },

  async userInfo(ctx) {
    const rawUserId = ctx.query?.userId;
    const service = strapi.service('api::public-auth.public-auth');

    try {
      const userId = Number(rawUserId);

      if (!Number.isInteger(userId) || userId <= 0) {
        return ctx.badRequest('userId es requerido y debe ser un entero positivo');
      }

      const result = await service.userInfo(userId, ctx);

      if (!result) {
        return ctx.notFound('Usuario no encontrado');
      }

      ctx.status = 200;
      return ctx.send(result);
    } catch (error) {
      strapi.log.error('Error fetching user info', error);
      return ctx.throw(500, 'No fue posible obtener la información del usuario');
    }
  },
};

export { ConflictError };