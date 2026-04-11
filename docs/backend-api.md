# Guia de API del Backend

## Resumen

Backend de ecommerce en Strapi 5.

- URL local base: `http://localhost:1337`
- Base REST: `http://localhost:1337/api`
- Limite por defecto de paginacion: `25`
- Limite maximo de paginacion: `100`
- JWT (`users-permissions`): `1d`
- Upload provider: `local` (`public/uploads`)
- Base de datos por defecto: SQLite en `.tmp/data.db`

Importante para frontend:

- Hay nombres expuestos con typo y se consumen tal cual:
  - `adress` / `adresses`
  - `delivery-assigment` / `delivery-assigments`
- Todos los content-types de `src/api` tienen `draftAndPublish = false`.
- En `bootstrap` se aseguran los roles: `customer`, `seller`, `delivery`, `operations`.

## Ejecucion local

```bash
npm install
npm run develop
```

Variables base en `.env` (ejemplo en `.env.example`).

## Autenticacion y Roles

### Headers

```http
Authorization: Bearer <jwt>
```

### Politicas custom

- `global::seller-auth`: requiere JWT y perfil seller (acepta usuarios seller legacy con role `authenticated`)
- `global::customer-auth`: requiere JWT y rol `customer`
- `global::operations-auth`: requiere JWT con rol `operations` o `admin`

## Endpoints Custom

### Public (sin JWT)

- `POST /api/public-auth/register/customer`
- `POST /api/public-auth/register/seller`
- `POST /api/public-auth/login`
- `GET /api/public-auth/user-info?userId=<id>`

### Seller (JWT seller)

- `GET /api/sellers/me`
- `PATCH /api/sellers/me/profile`
- `GET /api/sellers/me/dashboard`
- `GET /api/sellers/me/sales-metrics?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/sellers/products`
- `GET /api/sellers/orders`
- `POST /api/sellers/products`
- `PATCH /api/sellers/products/:id`
- `PATCH /api/sellers/products/:id/toggle-active`
- `POST /api/sellers/products/:id/deactivation-request`
- `GET /api/sellers/products/:id/deactivation-request`
- `POST /api/sellers/products/:id/review-request`
- `GET /api/sellers/warehouse-assignment`
- `POST /api/sellers/delivery-request`

### Customer (JWT customer)

- `POST /api/orders/checkout`

### Operaciones/Admin interno (JWT operations/admin)

- `GET /api/admin/sellers/:id/logistics`
- `PATCH /api/admin/sellers/:id/assign-warehouse`
- `GET /api/admin/product-requests`
- `PATCH /api/admin/product-requests/:id/resolve`

## Endpoints Core CRUD (Strapi)

Routers nativos `createCoreRouter` declarados actualmente:

- `/api/products`
- `/api/categories`
- `/api/warehouses`
- `/api/sellers`
- `/api/adresses`
- `/api/orders`
- `/api/order-items`
- `/api/delivery-assigments`
- `/api/deliveries`
- `/api/customers`
- `/api/product-moderation-requests`

Operaciones tipicas por collection type:

- `GET /api/<collection>`
- `GET /api/<collection>/:documentId`
- `POST /api/<collection>`
- `PUT /api/<collection>/:documentId`
- `DELETE /api/<collection>/:documentId`

Nota:

- Existe content-type `delivery-request`, pero en este momento no tiene archivo de rutas core en `src/api/delivery-request/routes`, por lo que no debe asumirse `/api/delivery-requests` como endpoint nativo activo.

## Flujos y Payloads Clave

### 1) Registro customer

`POST /api/public-auth/register/customer`

Request:

```json
{
  "username": "jane",
  "email": "jane@email.com",
  "password": "secret123",
  "firstName": "Jane",
  "phone": "5512345678"
}
```

Respuesta (`email_confirmation` desactivado):

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

Si `email_confirmation` esta activo, regresa `message + user + role` sin JWT.

Validaciones:

- `username`, `email`, `password`, `firstName`, `phone` requeridos
- `password` minimo 6
- `email` valido
- `409` si email/username ya existen

### 2) Registro seller

`POST /api/public-auth/register/seller`

Request:

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
    "approvalStatus": "pending",
    "storeName": "Mi Tienda"
  },
  "role": "seller"
}
```

Nota: siempre queda en `approvalStatus = pending`.

### 3) Login publico

`POST /api/public-auth/login`

Request:

```json
{
  "identifier": "user@email.com",
  "password": "secret123"
}
```

Respuesta:

```json
{
  "jwt": "token",
  "user": {
    "id": 1,
    "username": "jane",
    "email": "user@email.com",
    "firstName": "Jane",
    "phone": "5512345678"
  },
  "role": "customer",
  "seller": null
}
```

### 4) Checkout customer

`POST /api/orders/checkout` (requiere JWT `customer`)

Request:

```json
{
  "adressId": 7,
  "deliveryFee": 25,
  "notes": "Entregar antes de las 6 pm",
  "items": [
    { "productId": 5, "quantity": 2 },
    { "productId": 9, "quantity": 1 }
  ]
}
```

Reglas de negocio:

- valida ownership de `adressId` contra el customer autenticado
- valida producto activo y `moderationStatus = active` (o null legacy)
- valida stock suficiente
- descuenta inventario por item en transaccion
- crea `order` + `order-items`

Errores esperados:

- `400` payload invalido
- `409` cuando hay conflictos de stock/producto con `errors[]`

Respuesta exitosa:

```json
{
  "message": "Orden creada correctamente",
  "order": {
    "id": 101,
    "orderNumber": "ORD-1710972279712-3",
    "statusOrder": "pending",
    "payment_status": "pending"
  }
}
```

### 5) Moderacion de producto

Seller:

- `POST /api/sellers/products/:id/review-request`
- `POST /api/sellers/products/:id/deactivation-request`
- `GET /api/sellers/products/:id/deactivation-request` (consulta ultima solicitud de baja)

Body opcional:

```json
{
  "reason": "texto libre"
}
```

Al crear solicitud:

- se crea `product-moderation-request` en `pending`
- el producto pasa a `isActive = false`
- `moderationStatus` pasa a `review_pending` o `deactivation_pending`

Operaciones resuelve:

`PATCH /api/admin/product-requests/:id/resolve`

```json
{
  "action": "approve",
  "resolutionNotes": "Aprobado por operaciones"
}
```

`action` permitido: `approve | reject`

Estados finales de producto:

- approve + `review` -> `moderationStatus = active`, `isActive = true`
- approve + `deactivation` -> `moderationStatus = deactivated`, `isActive = false`
- reject -> `moderationStatus = rejected`, `isActive = false`

## Modelos (campos principales)

### product

- `name` (required)
- `slug`
- `description` (`blocks`)
- `sku` (unique)
- `price` (required)
- `unit`: `kg | pieza | caja | manojo | bolsa`
- `minOrderQty`
- `stock` (default `0`)
- `images` (media multiple)
- `isActive` (default `true`)
- `moderationStatus` (required): `active | review_pending | deactivation_pending | deactivated | rejected`
- relaciones: `seller`, `category`, `orderItems`, `moderationRequests`

### seller

- `storeName` (required)
- `slug`
- `description`
- `contactPhone`
- `address` (json)
- `profileImage` (media)
- `isVerified` (default `false`)
- `approvalStatus` (required): `pending | approved | rejected`
- `warehouseAssignmentStatus` (required): `pending | assigned`
- `deliveryInstructions`
- `assignedWarehouse`
- `users_permissions_user`

### warehouse

- `name` (required, unique)
- `code` (required, unique)
- `address`, `city`, `state` (required)
- enums:
  - `produceFocus`: `fruits | vegetables | mixed`
  - `storageMode`: `ambient | refrigerated | mixed`

### order / order-item

- `order.statusOrder`: `pending | confirmed | preparing | out_for_delivery | delivered | cancelled`
- `order.payment_status`: `pending | paid | failed | refunded`
- `order`: `subtotal`, `deliveryFee`, `total`, `adress`, `customer`, `items`, `deliveryAssigment`
- `order-item`: `quantity`, `unit_price`, `subtotal` (required), snapshot fields

### delivery-request

- `status` (required): `received | in_review | resolved`
- `notes`
- `seller`

### product-moderation-request

- `type` (required): `review | deactivation`
- `status` (required): `pending | approved | rejected`
- `reason`, `resolutionNotes`, `reviewedAt`
- relaciones: `product`, `seller`, `reviewedBy`

## Patrones de Query utiles

Populate:

- `GET /api/products?populate=seller,category,images`
- `GET /api/orders?populate=adress,deliveryAssigment&populate[items][populate]=product,seller`

Filtros:

- `GET /api/products?filters[isActive][$eq]=true`
- `GET /api/products?filters[moderationStatus][$eq]=active`
- `GET /api/orders?filters[customer][id][$eq]=3`

Paginacion:

- `GET /api/products?pagination[page]=1&pagination[pageSize]=12`

Orden:

- `GET /api/orders?sort=createdAt:desc`

## Media

Provider configurado:

- `local`
- directorio fisico: `public/uploads`
- URL publica base: `/uploads`

Ejemplo URL completa en local:

- `http://localhost:1337/uploads/example.jpg`

## Notas para Frontend

- El backend mantiene typos historicos (`adress`, `delivery-assigment`).
- `description` de `product` es `blocks` (no HTML plano).
- `decimal` puede llegar serializado como string en respuestas REST.
- En `GET /api/sellers/products` se devuelven ambos `data` e `items` para compatibilidad.
- Seller no aprobado puede autenticarse, pero endpoints de gestion de producto exigen `approvalStatus = approved`.

## Direcciones: rutas validas y errores comunes

Rutas existentes para direcciones:

- `GET /api/adresses`
- `GET /api/adresses/:documentId`
- `POST /api/adresses`
- `PUT /api/adresses/:documentId`
- `DELETE /api/adresses/:documentId`

Rutas **no implementadas** en backend actual:

- `POST /api/adresses/my`
- `POST /api/customers/me/adresses`

Por eso esas llamadas devuelven `405 Method Not Allowed`.

Formato correcto para crear direccion (`POST /api/adresses`):

```json
{
  "data": {
    "label": "Casa",
    "recipientName": "Jane Doe",
    "phone": "5512345678",
    "street": "Av. Convencion de 1914",
    "externalNumber": "102",
    "internalNumber": "4B",
    "neighborhood": "Del Valle",
    "city": "Aguascalientes",
    "state": "Aguascalientes",
    "zipCode": "20270",
    "references": "Porton blanco",
    "lat": 21.8764,
    "lng": -102.2644,
    "isDefault": true,
    "user": 3
  }
}
```

Nota:

- En Strapi, si envias el body sin el wrapper `data`, normalmente responde `400`.
- Filtro valido para direcciones por usuario: `filters[user][id][$eq]=<userId>` o `filters[user][$eq]=<userId>`.
- Filtros como `filters[customer][...]` no aplican en `adress` y devuelven `400`.
