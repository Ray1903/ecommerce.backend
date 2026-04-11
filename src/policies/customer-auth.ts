const USER_UID = 'plugin::users-permissions.user';

export default async (policyContext) => {
  const authUser = policyContext.state?.user;

  if (!authUser?.id) {
    policyContext.unauthorized('Debes iniciar sesion con tu JWT de customer');
    return false;
  }

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: authUser.id },
    populate: {
      role: true,
    },
  });

  if (user?.role?.type !== 'customer') {
    policyContext.forbidden('El usuario autenticado no tiene permisos de customer');
    return false;
  }

  return true;
};
