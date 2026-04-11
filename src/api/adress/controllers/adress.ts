

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::adress.adress', ({ strapi }) => ({

async createMy (ctx){
    const userId = ctx.state.user.id;
    const { body } = ctx.request;
    
    if (!body) {
        return ctx.badRequest('No se proporcionaron datos');
    }
    const { data } = body;
    
    if (!data) {
        return ctx.badRequest('No se proporcionaron datos');
    }

    const newAdress = await strapi.db.query('api::adress.adress').create({
        data: {
            ...data,
            user: userId,
        },
     });
     
     return newAdress;
},

async updateMy(ctx) {
    const userId = ctx.state.user.id;
    const adressId = ctx.params.id;
    const { body } = ctx.request;

    if (!body) {
        return ctx.badRequest('No se proporcionaron datos');
    }
    const { data } = body;

    if (!data) {
        return ctx.badRequest('No se proporcionaron datos');
    }
    
    const adress = await strapi.db.query('api::adress.adress').findOne({
        where: {
            id: adressId,
            user: userId,
        },
    });
    
    if (!adress) {
        return ctx.notFound('Direccion no encontrada o no pertenece al usuario');
    }

    await strapi.db.query('api::adress.adress').update({
        where: {
            id: adressId,
        },
        data: {
            ...data,
        },
    });
    return ctx.send({status: 'success', message: 'Direccion actualizada exitosamente'});
},

async findMy(ctx) {
  const userId = ctx.state.user.id;

  const data = await strapi.db.query('api::adress.adress').findMany({
    where: {
      user: userId,
    },
    orderBy: { id: 'desc' }
  });

  return data;
},

async delete(ctx) {
    const userId = ctx.state.user.id;  

    const adressId = ctx.params.id;

    const adress = await strapi.db.query('api::adress.adress').findOne({
        where: {
            id: adressId,
            user: userId,
        },
    });
    
    if (!adress) {
        return ctx.notFound('Direccion no encontrada o no pertenece al usuario');
    }

    await strapi.db.query('api::adress.adress').delete({
        where: {
            id: adressId,
        },
    });

    return ctx.send({ message: 'Direccion eliminada exitosamente' });
}

}));