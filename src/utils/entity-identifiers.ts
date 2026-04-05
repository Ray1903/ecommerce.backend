const slugifySegment = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

export const buildEntitySlug = (value: string, id: number | string) => {
  const baseSlug = slugifySegment(value);
  const idPart = String(id).trim();

  if (!baseSlug) {
    return idPart;
  }

  return `${baseSlug}-${idPart}`;
};

export const buildProductSku = (id: number | string) => {
  const numericId = Number(id);

  if (Number.isInteger(numericId) && numericId > 0) {
    return `SKU-${String(numericId).padStart(6, '0')}`;
  }

  return `SKU-${String(id).trim()}`;
};
