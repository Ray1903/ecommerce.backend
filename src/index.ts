import type { Core } from '@strapi/strapi';

const PUBLIC_ROLE_UID = 'plugin::users-permissions.role';
const CATEGORY_UID = 'api::category.category';
const WAREHOUSE_UID = 'api::warehouse.warehouse';

const REQUIRED_ROLES = [
  {
    name: 'customer',
    type: 'customer',
    description: 'Comprador de la plataforma',
  },
  {
    name: 'seller',
    type: 'seller',
    description: 'Vendedor pendiente o aprobado para operar en la plataforma',
  },
  {
    name: 'delivery',
    type: 'delivery',
    description: 'Repartidor de la plataforma',
  },
  {
    name: 'operations',
    type: 'operations',
    description: 'Operaciones internas para asignacion logistica y seguimiento',
  },
];

const REQUIRED_CATEGORIES = [
  {
    name: 'Frutas',
    description:
      'Alimento de origen vegetal que provienen de las plantas y contienen semillas',
    is_active: true,
  },
  {
    name: 'Verduras',
    description: 'Verduras frescas para cocina diaria.',
    is_active: true,
  },
  {
    name: 'Hierbas y Especias',
    description: 'Hierbas aromaticas y especias frescas o secas.',
    is_active: true,
  },
  {
    name: 'Legumbres',
    description: 'Leguminosas frescas o secas ricas en proteina vegetal.',
    is_active: true,
  },
  {
    name: 'Granos y Cereales',
    description: 'Granos y cereales para alimentacion basica.',
    is_active: true,
  },
  {
    name: 'Citricos',
    description: 'Naranja, limon, toronja y similares.',
    is_active: true,
  },
  {
    name: 'Frutas Tropicales',
    description: 'Mango, pina, papaya, platano y similares.',
    is_active: true,
  },
  {
    name: 'Berries',
    description: 'Fresa, zarzamora, arandano y frambuesa.',
    is_active: true,
  },
  {
    name: 'Manzana y Pera',
    description: 'Variedades de manzana y pera.',
    is_active: true,
  },
  {
    name: 'Hojas Verdes',
    description: 'Lechuga, espinaca, acelga y similares.',
    is_active: true,
  },
  {
    name: 'Cruciferas',
    description: 'Brocoli, coliflor, col y similares.',
    is_active: true,
  },
  {
    name: 'Raices y Tuberculos',
    description: 'Papa, zanahoria, betabel, camote y similares.',
    is_active: true,
  },
  {
    name: 'Hierbas Frescas',
    description: 'Cilantro, perejil, albahaca y menta.',
    is_active: true,
  },
];

const REQUIRED_WAREHOUSES = [
  {
    name: 'Zona Norte Aguascalientes',
    code: 'WH-AGS-NORTE',
    description: 'Warehouse de recepcion para zona norte de Aguascalientes',
    address: 'Av Aguascalientes Nte 600, Centro Comercial Agropecuario',
    city: 'Aguascalientes',
    state: 'Aguascalientes',
    postalCode: '20138',
    contactPhone: '+52 449 996 5746',
    contactEmail: 'warehouse.norte@agrorun.local',
    managerName: 'Supervisor Zona Norte',
    produceFocus: 'fruits',
    storageMode: 'mixed',
    operatingHours: 'Lunes a Domingo 04:00 - 19:00',
    capacityKg: 22000,
    minimumTemperature: 2,
    maximumTemperature: 18,
    isActive: true,
    acceptedCategoryNames: [
      'Frutas',
      'Citricos',
      'Frutas Tropicales',
      'Berries',
      'Manzana y Pera',
      'Hierbas Frescas',
    ],
  },
  {
    name: 'Zona Sur Aguascalientes',
    code: 'WH-AGS-SUR',
    description: 'Warehouse de consolidacion para zona sur de Aguascalientes',
    address: 'Del Abasto s/n, San Francisco del Arenal',
    city: 'Aguascalientes',
    state: 'Aguascalientes',
    postalCode: '20280',
    contactPhone: '+52 449 971 1121',
    contactEmail: 'warehouse.sur@agrorun.local',
    managerName: 'Supervisor Zona Sur',
    produceFocus: 'vegetables',
    storageMode: 'mixed',
    operatingHours: 'Lunes a Sabado 08:30 - 18:00',
    capacityKg: 26000,
    minimumTemperature: 4,
    maximumTemperature: 22,
    isActive: true,
    acceptedCategoryNames: [
      'Verduras',
      'Hojas Verdes',
      'Cruciferas',
      'Raices y Tuberculos',
      'Legumbres',
      'Granos y Cereales',
      'Hierbas y Especias',
      'Hierbas Frescas',
    ],
  },
];

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    for (const roleData of REQUIRED_ROLES) {
      const existingRole = await strapi.db.query(PUBLIC_ROLE_UID).findOne({
        where: { type: roleData.type },
      });

      if (!existingRole) {
        await strapi.db.query(PUBLIC_ROLE_UID).create({
          data: roleData,
        });
      }
    }

    const categoryIdsByName = new Map<string, number>();

    for (const categoryData of REQUIRED_CATEGORIES) {
      const existingCategory = await strapi.db.query(CATEGORY_UID).findOne({
        where: { name: categoryData.name },
      });

      if (existingCategory) {
        await strapi.db.query(CATEGORY_UID).update({
          where: { id: existingCategory.id },
          data: {
            description: categoryData.description,
            is_active: categoryData.is_active,
          },
        });

        categoryIdsByName.set(categoryData.name, existingCategory.id);
        continue;
      }

      const createdCategory = await strapi.db.query(CATEGORY_UID).create({
        data: categoryData,
      });

      categoryIdsByName.set(categoryData.name, createdCategory.id);
    }

    for (const warehouseData of REQUIRED_WAREHOUSES) {
      const acceptedCategoryIds = warehouseData.acceptedCategoryNames
        .map((categoryName) => categoryIdsByName.get(categoryName))
        .filter((categoryId): categoryId is number => Number.isInteger(categoryId));
      const { acceptedCategoryNames, ...warehouseFields } = warehouseData;

      const existingWarehouse = await strapi.db.query(WAREHOUSE_UID).findOne({
        where: {
          $or: [{ code: warehouseData.code }, { name: warehouseData.name }],
        },
      });

      if (existingWarehouse) {
        await strapi.db.query(WAREHOUSE_UID).update({
          where: { id: existingWarehouse.id },
          data: {
            ...warehouseFields,
            acceptedCategories: acceptedCategoryIds,
          },
        });

        continue;
      }

      await strapi.db.query(WAREHOUSE_UID).create({
        data: {
          ...warehouseFields,
          acceptedCategories: acceptedCategoryIds,
        },
      });
    }
  },
};
