export default {
  routes: [
    {
      method: 'GET',
      path: '/sellers/me',
      handler: 'seller.me',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'PATCH',
      path: '/sellers/me/profile',
      handler: 'seller.updateProfile',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'GET',
      path: '/sellers/me/dashboard',
      handler: 'seller.dashboard',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'GET',
      path: '/sellers/products',
      handler: 'seller.products',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'POST',
      path: '/sellers/products',
      handler: 'seller.createProduct',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'PATCH',
      path: '/sellers/products/:id',
      handler: 'seller.updateProduct',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'PATCH',
      path: '/sellers/products/:id/toggle-active',
      handler: 'seller.toggleActive',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'GET',
      path: '/sellers/warehouse-assignment',
      handler: 'seller.warehouseAssignment',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'POST',
      path: '/sellers/delivery-request',
      handler: 'seller.createDeliveryRequest',
      config: {
        policies: ['global::seller-auth'],
      },
    },
    {
      method: 'GET',
      path: '/admin/sellers/:id/logistics',
      handler: 'seller.adminLogistics',
      config: {
        policies: ['global::operations-auth'],
      },
    },
    {
      method: 'PATCH',
      path: '/admin/sellers/:id/assign-warehouse',
      handler: 'seller.assignWarehouse',
      config: {
        policies: ['global::operations-auth'],
      },
    },
  ],
};
