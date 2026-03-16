# Guia de API del Backend

## Resumen

Este proyecto es un backend en Strapi 5 para un flujo de ecommerce.

- URL local base: `http://localhost:1337`
- Base REST: `http://localhost:1337/api`
- Base de autenticacion: `http://localhost:1337/api/auth`
- Limite por defecto de paginacion: `25`
- Limite maximo de paginacion: `100`
- Expiracion del JWT: `1d`
- Base de datos por defecto: SQLite en `.tmp/data.db`

Puntos importantes para frontend:

- Los content-types usan las rutas REST base de Strapi.
- Hay endpoints custom para registro publico de usuarios.
- Hay nombres expuestos con typo y frontend debe consumirlos tal cual:
  - `adress`
  - `adresses`
  - `delivery-assigment`
  - `delivery-assigments`
- Los roles `customer`, `seller` y `delivery` se aseguran automaticamente en el `bootstrap` del backend.

## Ejecucion local

```bash
npm install
npm run develop
```

Las variables de entorno base viven en `.env` y existe un ejemplo en `.env.example`.

## Autenticacion

La autenticacion usa el plugin `users-permissions` de Strapi.

### Endpoints principales

- `POST /api/public-auth/register/customer`
- `POST /api/public-auth/register/seller`
- `POST /api/auth/local`
- `GET /api/users/me`
- `GET /api/users/:id`
- `GET /api/users`
- `PUT /api/users/:id`

### Registro publico recomendado

El registro publico ya no debe usar `POST /api/auth/local/register` como flujo principal.

Se exponen dos endpoints custom:

- `POST /api/public-auth/register/customer`
- `POST /api/public-auth/register/seller`

Por ahora no existe alta publica para `delivery`.

#### Registro de `customer`

Payload:

```json
{
  "username": "jane",
  "email": "jane@email.com",
  "password": "secret123",
  "firstName": "Jane",
  "phone": "5512345678"
}
```

Respuesta:

```json
{
  "jwt": "token",
  "user": {
    "id": 1,
    "username": "jane",
    "email": "jane@email.com"
  },
  "role": "customer"
}
```

Si `users-permissions.email_confirmation` esta activo, la respuesta cambia a un mensaje sin JWT inmediato:

- `message`: confirmacion de correo requerida
- `user`
- `role: customer`

#### Registro de `seller`

Payload:

```json
{
  "username": "tienda-demo",
  "email": "seller@email.com",
  "password": "secret123",
  "firstName": "Seller Demo",
  "phone": "5512345678",
  "storeName": "Mi Tienda",
  "contactPhone": "5512345678",
  "description": "Frutas y verduras"
}
```

Notas de comportamiento:

- no devuelve JWT automatico
- crea el usuario con rol `seller`
- crea el perfil `seller` con `status = pending`
- frontend no debe mostrar funcionalidades de seller hasta que `status = approved`

Respuesta:

```json
{
  "message": "Solicitud de seller recibida y pendiente de aprobacion",
  "user": {
    "id": 2,
    "username": "tienda-demo",
    "email": "seller@email.com"
  },
  "seller": {
    "id": 1,
    "documentId": "xxxxx",
    "status": "pending",
    "storeName": "Mi Tienda"
  },
  "role": "seller"
}
```

Validaciones de ambos endpoints:

- `username` requerido
- `email` requerido y valido
- `password` minimo 6 caracteres
- `firstName` requerido
- `phone` requerido
- `storeName` requerido para seller
- `409` si el email o username ya existen
- si `email_confirmation` esta activo, customer no recibe JWT inmediato

### Login

Request:

```json
{
  "identifier": "user@email.com",
  "password": "secret123"
}
```

Respuesta esperada:

```json
{
  "jwt": "token",
  "user": {
    "id": 1,
    "username": "jane",
    "email": "user@email.com"
  }
}
```

Header para requests autenticados:

```http
Authorization: Bearer <jwt>
```

Nota para seller:

- un seller pendiente puede iniciar sesion si sus credenciales son validas
- el frontend debe consultar el perfil relacionado y bloquear el dashboard seller mientras `seller.status !== 'approved'`

### Campos extendidos del usuario

El modelo `user` fue extendido con:

- `firstName`: `string`
- `phone`: `string`
- `isActive`: `boolean`
- `seller`: relacion one-to-one con `seller`
- `orders`: relacion one-to-many con `order`
- `adresses`: relacion one-to-many con `adress`
- `deliveryAssigments`: relacion one-to-many con `delivery-assigment`

Consulta util:

- `GET /api/users/me?populate=seller,orders,adresses,deliveryAssigments`

## Formato de respuesta

En REST, frontend debe esperar principalmente:

- Colecciones: `{ data: [...], meta: { pagination } }`
- Un registro: `{ data: { ... } }`

Campos comunes que devuelve Strapi:

- `id`
- `documentId`
- `createdAt`
- `updatedAt`
- `publishedAt` en modelos con draft/publish

Nota:

- Los `decimal` pueden llegar serializados como string. Conviene normalizarlos antes de hacer calculos.

## Patrones de query utiles

### Populate

Ejemplos:

- `GET /api/products?populate=*`
- `GET /api/orders?populate=customer,adress,deliveryAssigment&populate[items][populate]=product,seller`
- `GET /api/users/me?populate=seller,adresses,orders`

### Filtros

Ejemplos:

- `GET /api/products?filters[isActive][$eq]=true`
- `GET /api/products?filters[slug][$eq]=tomate-saladette`
- `GET /api/orders?filters[customer][id][$eq]=3`
- `GET /api/adresses?filters[user][id][$eq]=3`
- `GET /api/delivery-assigments?filters[deliveryUser][id][$eq]=8`

### Paginacion

Ejemplos:

- `GET /api/products?pagination[page]=1&pagination[pageSize]=12`
- `GET /api/products?pagination[start]=0&pagination[limit]=20`

### Ordenamiento

Ejemplos:

- `GET /api/products?sort=name:asc`
- `GET /api/orders?sort=createdAt:desc`

## Content Types

## `product`

Rutas:

- `GET /api/products`
- `GET /api/products/:documentId`
- `POST /api/products`
- `PUT /api/products/:documentId`
- `DELETE /api/products/:documentId`

Draft/publish:

- Desactivado

Campos:

- `name`: `string`, requerido
- `slug`: `uid`, generado desde `name`
- `description`: `blocks`
- `sku`: `string`, unico
- `price`: `decimal`, requerido
- `unit`: enum `kg | pieza | caja | manojo | bolsa`
- `minOrderQty`: `decimal`
- `isActive`: `boolean`, default `true`
- `seller`: many-to-one -> `seller`
- `category`: many-to-one -> `category`
- `orderItems`: one-to-many -> `order-item`

Queries utiles:

- `GET /api/products?filters[isActive][$eq]=true&populate=seller,category`
- `GET /api/products?filters[slug][$eq]=tomate-saladette&populate=*`
- `GET /api/products?filters[category][slug][$eq]=frutas&populate=category,seller`

Ejemplo de creacion:

```json
{
  "data": {
    "name": "Tomate Saladette",
    "sku": "TOM-001",
    "price": 42.5,
    "unit": "kg",
    "minOrderQty": 1,
    "isActive": true,
    "seller": 1,
    "category": 3
  }
}
```

## `category`

Rutas:

- `GET /api/categories`
- `GET /api/categories/:documentId`
- `POST /api/categories`
- `PUT /api/categories/:documentId`
- `DELETE /api/categories/:documentId`

Draft/publish:

- Activado

Campos:

- `name`: `string`, requerido, unico
- `slug`: `uid`, generado desde `name`
- `description`: `string`
- `is_active`: `boolean`
- `image`: media
- `parent`: many-to-one -> `category`
- `children`: one-to-many -> `category`
- `products`: one-to-many -> `product`

Queries utiles:

- `GET /api/categories?filters[parent][id][$null]=true&populate=children,image`
- `GET /api/categories?filters[slug][$eq]=verduras&populate=parent,children,image`

## `seller`

Rutas:

- `GET /api/sellers`
- `GET /api/sellers/:documentId`
- `POST /api/sellers`
- `PUT /api/sellers/:documentId`
- `DELETE /api/sellers/:documentId`

Draft/publish:

- Activado

Campos:

- `storeName`: `string`, requerido
- `slug`: `uid`, generado desde `storeName`
- `description`: `string`
- `contactPhone`: `string`
- `isVerified`: `boolean`, default `false`
- `status`: enum `pending | approved | rejected`, default `pending`
- `users_permissions_user`: one-to-one -> `user`
- `products`: one-to-many -> `product`
- `order_items`: one-to-many -> `order-item`

Queries utiles:

- `GET /api/sellers?populate=products`
- `GET /api/sellers?filters[slug][$eq]=mi-tienda&populate=products,users_permissions_user`
- `GET /api/sellers?filters[status][$eq]=approved&populate=products`

## `adress`

Rutas:

- `GET /api/adresses`
- `GET /api/adresses/:documentId`
- `POST /api/adresses`
- `PUT /api/adresses/:documentId`
- `DELETE /api/adresses/:documentId`

Draft/publish:

- Activado

Campos:

- `label`: `string`
- `recipientName`: `string`
- `phone`: `string`
- `street`: `string`
- `externalNumber`: `string`
- `internalNumber`: `string`
- `neighborhood`: `string`
- `city`: `string`
- `state`: `string`
- `zipCode`: `string`
- `references`: `text`
- `lat`: `float`
- `lng`: `float`
- `user`: many-to-one -> `user`
- `isDefault`: `boolean`
- `orders`: one-to-many -> `order`

Queries utiles:

- `GET /api/adresses?filters[user][id][$eq]=3`
- `GET /api/adresses?filters[user][id][$eq]=3&filters[isDefault][$eq]=true`

Ejemplo de creacion:

```json
{
  "data": {
    "label": "Casa",
    "recipientName": "Jane Doe",
    "phone": "5512345678",
    "street": "Av. Reforma",
    "externalNumber": "123",
    "internalNumber": "4B",
    "neighborhood": "Centro",
    "city": "Ciudad de Mexico",
    "state": "CDMX",
    "zipCode": "06000",
    "references": "Puerta negra",
    "lat": 19.4326,
    "lng": -99.1332,
    "user": 3,
    "isDefault": true
  }
}
```

## `order`

Rutas:

- `GET /api/orders`
- `GET /api/orders/:documentId`
- `POST /api/orders`
- `PUT /api/orders/:documentId`
- `DELETE /api/orders/:documentId`

Draft/publish:

- Desactivado

Campos:

- `statusOrder`: enum `pending | confirmed | preparing | out_for_delivery | delivered | cancelled`
- `payment_status`: enum `pending | paid | failed | refunded`
- `subtotal`: `decimal`
- `deliveryFee`: `decimal`
- `total`: `decimal`
- `notes`: `string`
- `adress`: many-to-one -> `adress`
- `orderNumber`: `string`
- `customer`: many-to-one -> `user`
- `items`: one-to-many -> `order-item`
- `deliveryAssigment`: one-to-one -> `delivery-assigment`

Queries utiles:

- `GET /api/orders?filters[customer][id][$eq]=3&populate=adress,deliveryAssigment`
- `GET /api/orders?filters[orderNumber][$eq]=ORD-1001&populate[items][populate]=product,seller`
- `GET /api/orders?sort=createdAt:desc&populate=customer,adress,deliveryAssigment`

Ejemplo de creacion:

```json
{
  "data": {
    "statusOrder": "pending",
    "payment_status": "pending",
    "subtotal": 180,
    "deliveryFee": 25,
    "total": 205,
    "notes": "Entregar antes de las 6 pm",
    "adress": 7,
    "customer": 3,
    "orderNumber": "ORD-1001"
  }
}
```

## `order-item`

Rutas:

- `GET /api/order-items`
- `GET /api/order-items/:documentId`
- `POST /api/order-items`
- `PUT /api/order-items/:documentId`
- `DELETE /api/order-items/:documentId`

Draft/publish:

- Activado

Campos:

- `quantity`: `decimal`, requerido
- `unit_price`: `decimal`, requerido
- `subtotal`: `decimal`, requerido
- `productNameSnapshot`: `string`
- `unitSnapshot`: `string`
- `product`: many-to-one -> `product`
- `seller`: many-to-one -> `seller`
- `order`: many-to-one -> `order`

Queries utiles:

- `GET /api/order-items?filters[order][id][$eq]=15&populate=product,seller`

Ejemplo de creacion:

```json
{
  "data": {
    "quantity": 2,
    "unit_price": 42.5,
    "subtotal": 85,
    "productNameSnapshot": "Tomate Saladette",
    "unitSnapshot": "kg",
    "product": 5,
    "seller": 1,
    "order": 15
  }
}
```

## `delivery-assigment`

Rutas:

- `GET /api/delivery-assigments`
- `GET /api/delivery-assigments/:documentId`
- `POST /api/delivery-assigments`
- `PUT /api/delivery-assigments/:documentId`
- `DELETE /api/delivery-assigments/:documentId`

Draft/publish:

- Activado

Campos:

- `statusDelivery`: enum `pending | assigned | picked_up | delivered | failed`
- `assignedAt`: `datetime`
- `deliveredAt`: `datetime`
- `notes`: `string`
- `order`: one-to-one -> `order`
- `deliveryUser`: many-to-one -> `user`

Queries utiles:

- `GET /api/delivery-assigments?populate=order,deliveryUser`
- `GET /api/delivery-assigments?filters[deliveryUser][id][$eq]=8&populate=order`

## Flujos sugeridos para frontend

### Alta de customer

```http
POST /api/public-auth/register/customer
```

Campos sugeridos en UI:

- `firstName`
- `username`
- `email`
- `phone`
- `password`
- `confirmPassword`

### Alta de seller

```http
POST /api/public-auth/register/seller
```

Campos sugeridos en UI:

- `firstName`
- `username`
- `email`
- `phone`
- `password`
- `confirmPassword`
- `storeName`
- `contactPhone`
- `description`

### Confirmacion de solicitud seller

Despues del alta de seller, frontend debe mostrar una pantalla de confirmacion con mensaje de solicitud enviada.

Regla de negocio:

- el seller queda en `status = pending`
- frontend no debe habilitar dashboard seller hasta que el perfil seller tenga `status = approved`

### Listado de productos

```http
GET /api/products?filters[isActive][$eq]=true&populate=category,seller&sort=name:asc&pagination[page]=1&pagination[pageSize]=12
```

### Detalle de producto por slug

```http
GET /api/products?filters[slug][$eq]=tomate-saladette&populate=category,seller
```

### Categorias con hijos

```http
GET /api/categories?filters[parent][id][$null]=true&populate=children,image&sort=name:asc
```

### Perfil del usuario autenticado

```http
GET /api/users/me?populate=seller,adresses,orders,deliveryAssigments
```

### Direcciones del usuario autenticado

```http
GET /api/adresses?filters[user][id][$eq]=3&sort=createdAt:desc
```

### Pedidos del usuario con items

```http
GET /api/orders?filters[customer][id][$eq]=3&populate=adress,deliveryAssigment&populate[items][populate]=product,seller&sort=createdAt:desc
```

### Entregas asignadas a un repartidor

```http
GET /api/delivery-assigments?filters[deliveryUser][id][$eq]=8&populate=order
```

## Media

`category.image` usa el sistema de uploads de Strapi.

Normalmente los archivos se sirven en:

- `GET /uploads/<filename>`

Si el backend devuelve una URL relativa, frontend debe anteponer el origen del backend:

- `http://localhost:1337/uploads/example.jpg`

## Consideraciones para frontend

- `product`, `category`, `adress`, `order-item` y `delivery-assigment` usan draft/publish.
- `order` y `user` no usan draft/publish.
- `seller` no usa draft/publish y ahora controla aprobacion con `status`.
- `description` en `product` es un campo `blocks`, no HTML plano.
- Si los permisos del role no estan habilitados en el admin de Strapi, una ruta puede responder `403` aunque el content-type exista.
- El registro publico debe usar `public-auth/register/customer` y `public-auth/register/seller`, no `auth/local/register`.
- No hay registro publico para `delivery` en esta version.
- No hay endpoints custom de carrito, checkout, resumen de orden o calculo automatico. El frontend tiene que orquestar el flujo usando CRUD base.

## Tipos sugeridos para frontend

```ts
export type Product = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: unknown;
  sku?: string;
  price: number;
  unit?: 'kg' | 'pieza' | 'caja' | 'manojo' | 'bolsa';
  minOrderQty?: number;
  isActive?: boolean;
  seller?: Seller;
  category?: Category;
};

export type Category = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  is_active?: boolean;
};

export type Seller = {
  id: number;
  documentId: string;
  storeName: string;
  slug: string;
  description?: string;
  contactPhone?: string;
  isVerified?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
};

export type Adress = {
  id: number;
  documentId: string;
  label?: string;
  recipientName?: string;
  phone?: string;
  street?: string;
  externalNumber?: string;
  internalNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  references?: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
};

export type OrderItem = {
  id: number;
  documentId: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  productNameSnapshot?: string;
  unitSnapshot?: string;
  product?: Product;
  seller?: Seller;
};

export type Order = {
  id: number;
  documentId: string;
  statusOrder?: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
  subtotal?: number;
  deliveryFee?: number;
  total?: number;
  notes?: string;
  orderNumber?: string;
  adress?: Adress;
  items?: OrderItem[];
  deliveryAssigment?: DeliveryAssigment;
};

export type DeliveryAssigment = {
  id: number;
  documentId: string;
  statusDelivery?: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'failed';
  assignedAt?: string;
  deliveredAt?: string;
  notes?: string;
};
```
