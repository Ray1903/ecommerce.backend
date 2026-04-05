const USER_UID = 'plugin::users-permissions.user';
const ALLOWED_ROLE_TYPES = new Set(['operations', 'admin']);

export default async (policyContext) => {
  const authUser = policyContext.state?.user;

  if (!authUser?.id) {
    policyContext.unauthorized('Debes iniciar sesion con un JWT interno');
    return false;
  }

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: authUser.id },
    populate: {
      role: true,
    },
  });

  if (!ALLOWED_ROLE_TYPES.has(user?.role?.type)) {
    policyContext.forbidden('El usuario autenticado no tiene permisos internos');
    return false;
  }

  return true;
};
