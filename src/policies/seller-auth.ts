const USER_UID = 'plugin::users-permissions.user';

export default async (policyContext) => {
  const authUser = policyContext.state?.user;

  if (!authUser?.id) {
    policyContext.unauthorized('Debes iniciar sesion con tu JWT de seller');
    return false;
  }

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: authUser.id },
    populate: {
      role: true,
      seller: true,
    },
  });

  if (!user?.seller) {
    policyContext.forbidden('El usuario no tiene un perfil de seller');
    return false;
  }

  if (user.role?.type !== 'seller') {
    policyContext.forbidden('El usuario autenticado no tiene permisos de seller');
    return false;
  }

  return true;
};
