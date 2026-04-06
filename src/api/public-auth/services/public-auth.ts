import { errors } from '@strapi/utils';
import { ConflictError } from '../controllers/public-auth';

const { ApplicationError, ValidationError } = errors;

type RegisterBaseInput = {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  phone?: string;
};

type RegisterSellerInput = RegisterBaseInput & {
  storeName?: string;
  contactPhone?: string;
  description?: string;
};

type UsersPermissionsAdvancedSettings = {
  email_confirmation?: boolean;
};

const USER_UID = 'plugin::users-permissions.user';
const ROLE_UID = 'plugin::users-permissions.role';
const SELLER_UID = 'api::seller.seller';
const CUSTOMER_UID = 'api::customer.customer';
const DELIVERY_UID = 'api::delivery.delivery';

const sanitizeUser = (user, ctx) => {
  const auth = ctx.state?.auth;
  const userSchema = strapi.getModel(USER_UID);

  return strapi.contentAPI.sanitize.output(user, userSchema, { auth });
};

const normalizeString = (value?: string) =>
  typeof value === 'string' ? value.trim() : '';

export default () => ({

  async login(body, ctx) {
    const { identifier, password } = body ?? {};

    if (!identifier || !password) {
      throw new ValidationError('identifier y password son requeridos');
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();

    const user = await strapi.query('plugin::users-permissions.user').findOne({
      where: {
        $or: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
        ],
      },
      populate: ['role', 'seller'],
    });

    if (!user) {
      throw new ValidationError('Credenciales inválidas');
    }

    const isValidPassword = await strapi
      .plugin('users-permissions')
      .service('user')
      .validatePassword(password, user.password);

    if (!isValidPassword) {
      throw new ValidationError('Credenciales inválidas');
    }

    if (user.blocked) {
      throw new ApplicationError('Tu cuenta está bloqueada');
    }

    const pluginStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
    });

    const advancedSettings = (await pluginStore.get({ key: 'advanced' })) as UsersPermissionsAdvancedSettings | null;

    if (advancedSettings?.email_confirmation && !user.confirmed) {
      throw new ApplicationError('Debes confirmar tu correo antes de iniciar sesión');
    }

    const jwt = strapi.plugin('users-permissions').service('jwt').issue({
      id: user.id,
    });

    const resolvedRole = this.resolveUserRole(user);

    return {
      jwt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName ?? '',
        phone: user.phone ?? '',
      },
      role: resolvedRole,
      seller: user.seller ?? null,
    };
  },

  resolveUserRole(user) {
    const roleType = String(user?.role?.type ?? '')
      .trim()
      .toLowerCase();

    const roleName = String(user?.role?.name ?? '')
      .trim()
      .toLowerCase();

    const candidates = [roleType, roleName];

    for (const value of candidates) {
      if (!value) continue;

      if (value.includes('delivery')) return 'delivery';
      if (value.includes('seller')) return 'seller';
      if (value.includes('customer')) return 'customer';
      if (value.includes('operations')) return 'operations';
      if (value.includes('authenticated')) {
        // por si todos caen al role general authenticated
        // abajo intentamos resolver mejor con seller
      }
    }

    if (user?.seller) {
      return 'seller';
    }

    return 'customer';
  },

  async userInfo(userId: number, ctx) {
    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      populate: {
        profileImage: true,
        role: true,
        seller: {
          populate: {
            profileImage: true,
          },
        },
        customer: {
          populate: {
            profileImage: true,
          },
        },
        delivery: {
          populate: {
            profileImage: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return sanitizeUser(user, ctx);
  },

  async registerCustomer(payload: RegisterBaseInput, ctx) {
    const advancedSettings = (await strapi
      .store({ type: 'plugin', name: 'users-permissions' })
      .get({ key: 'advanced' })) as UsersPermissionsAdvancedSettings | null;

    const params = await this.validateBasePayload(payload);
    const role = await this.getRoleOrThrow('customer');

    await this.assertUserIsUnique(params.email, params.username);

    const newUser = await strapi.plugin('users-permissions').service('user').add({
      ...params,
      provider: 'local',
      role: role.id,
      email: params.email.toLowerCase(),
      username: params.username,
      confirmed: !advancedSettings?.email_confirmation,
      blocked: false,
      isActive: true,
    });

    await strapi.db.query(CUSTOMER_UID).create({
      data: {
        users_permissions_user: newUser.id,
      },
    });

    const sanitizedUser = await sanitizeUser(newUser, ctx);

    if (advancedSettings?.email_confirmation) {
      return {
        message: 'Usuario registrado. Debe confirmar su correo antes de iniciar sesion.',
        user: sanitizedUser,
        role: role.type,
      };
    }

    const jwt = await Promise.resolve(
      strapi.plugin('users-permissions').service('jwt').issue({ id: newUser.id })
    );

    return {
      jwt,
      user: sanitizedUser,
      role: role.type,
    };
  },

  async registerSeller(payload: RegisterSellerInput, ctx) {
    const advancedSettings = (await strapi
      .store({ type: 'plugin', name: 'users-permissions' })
      .get({ key: 'advanced' })) as UsersPermissionsAdvancedSettings | null;

    const baseParams = await this.validateBasePayload(payload);
    const storeName = normalizeString(payload.storeName);
    const contactPhone = normalizeString(payload.contactPhone);
    const description = normalizeString(payload.description);

    if (!storeName) {
      throw new ValidationError('El campo storeName es requerido');
    }

    const role = await this.getRoleOrThrow('seller');

    await this.assertUserIsUnique(baseParams.email, baseParams.username);

    let createdUser = null;

    try {
      createdUser = await strapi.plugin('users-permissions').service('user').add({
        ...baseParams,
        provider: 'local',
        role: role.id,
        email: baseParams.email.toLowerCase(),
        username: baseParams.username,
        confirmed: !advancedSettings?.email_confirmation,
        blocked: false,
        isActive: true,
      });

      const seller = await strapi.db.query(SELLER_UID).create({
        data: {
          storeName,
          contactPhone: contactPhone || baseParams.phone,
          description: description || null,
          isVerified: false,
          approvalStatus: 'pending',
          users_permissions_user: createdUser.id,
        },
      });

      const sanitizedUser = await sanitizeUser(createdUser, ctx);

      return {
        message: 'Solicitud de seller recibida y pendiente de aprobacion',
        user: sanitizedUser,
        seller: {
          id: seller.id,
          documentId: seller.documentId,
          approvalStatus: seller.approvalStatus,
          storeName: seller.storeName,
        },
        role: role.type,
      };
    } catch (error) {
      if (createdUser?.id) {
        await strapi.plugin('users-permissions').service('user').remove({ id: createdUser.id });
      }

      throw error;
    }
  },

  async validateBasePayload(payload: RegisterBaseInput) {
    const username = normalizeString(payload.username);
    const email = normalizeString(payload.email).toLowerCase();
    const password = typeof payload.password === 'string' ? payload.password : '';
    const firstName = normalizeString(payload.firstName);
    const phone = normalizeString(payload.phone);

    if (!username) {
      throw new ValidationError('El campo username es requerido');
    }

    if (!email) {
      throw new ValidationError('El campo email es requerido');
    }

    if (!password || password.length < 6) {
      throw new ValidationError('El password debe tener al menos 6 caracteres');
    }

    if (!firstName) {
      throw new ValidationError('El campo firstName es requerido');
    }

    if (!phone) {
      throw new ValidationError('El campo phone es requerido');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('El email no es valido');
    }

    return {
      username,
      email,
      password,
      firstName,
      phone,
    };
  },

  async assertUserIsUnique(email: string, username: string) {
    const identifierFilter = {
      $or: [
        { email },
        { username: email },
        { username },
        { email: username },
      ],
    };

    const conflictingUserCount = await strapi.db.query(USER_UID).count({
      where: identifierFilter,
    });

    if (conflictingUserCount > 0) {
      throw new ConflictError('El email o username ya estan registrados');
    }
  },

  async getRoleOrThrow(type: string) {
    const role = await strapi.db.query(ROLE_UID).findOne({
      where: { type },
    });

    if (!role) {
      throw new ApplicationError(`No se encontro el rol requerido: ${type}`);
    }

    return role;
  },
});
