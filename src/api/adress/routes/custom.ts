import path from "path";

export default {
  routes: [
    {
      method: 'GET',
      path: '/adress/me',
      handler: 'adress.findMy',
    },

    {
        method: 'DELETE',
        path: '/adress/:id',
        handler: 'adress.delete',
    },
    {
        method: 'POST',
        path: '/adress',
        handler: 'adress.createMy',
    },
    {
        method: 'PUT',
        path: '/adress/:id',
        handler: 'adress.updateMy',
    }
  ],
};