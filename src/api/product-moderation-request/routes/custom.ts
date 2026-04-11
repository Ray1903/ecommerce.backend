export default {
  routes: [
    {
      method: 'GET',
      path: '/admin/product-requests',
      handler: 'product-moderation-request.adminList',
      config: {
        policies: ['global::operations-auth'],
      },
    },
    {
      method: 'PATCH',
      path: '/admin/product-requests/:id/resolve',
      handler: 'product-moderation-request.resolve',
      config: {
        policies: ['global::operations-auth'],
      },
    },
  ],
};
