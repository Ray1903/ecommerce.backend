export default {
  routes: [
    {
      method: 'POST',
      path: '/public-auth/register/customer',
      handler: 'public-auth.registerCustomer',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/public-auth/register/seller',
      handler: 'public-auth.registerSeller',
      config: {
        auth: false,
      },
    },
  ],
};
