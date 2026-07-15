export const ARTICLES_PER_PAGE = 12;

export function getPageCount(totalItems, pageSize = ARTICLES_PER_PAGE) {
  if (!Number.isFinite(totalItems) || totalItems < 1) return 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function paginateItems(items, page = 1, pageSize = ARTICLES_PER_PAGE) {
  const allItems = Array.isArray(items) ? items : [];
  const totalItems = allItems.length;
  const totalPages = getPageCount(totalItems, pageSize);
  const parsedPage = Number.parseInt(String(page), 10);
  const currentPage = Math.min(
    Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1),
    totalPages,
  );
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    items: allItems.slice(startIndex, endIndex),
    currentPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex: Math.min(endIndex, totalItems),
  };
}

export function getPaginatedPath(basePath, page = 1) {
  const normalizedBase = String(basePath || '/').replace(/\/?$/, '/');
  const parsedPage = Number.parseInt(String(page), 10);
  const pageNumber = Number.isFinite(parsedPage) ? parsedPage : 1;

  if (pageNumber <= 1) return normalizedBase;
  return `${normalizedBase}page/${pageNumber}/`;
}
