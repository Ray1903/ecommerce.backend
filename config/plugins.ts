import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        localServer: {
          maxage: 300000,
        },
      },
      sizeLimit: 10 * 1024 * 1024,
    },
  },
  'users-permissions': {
    config: {
      jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_key',
      jwt: {
        expiresIn: '1d',
      },
    },
  },
});

export default config;
