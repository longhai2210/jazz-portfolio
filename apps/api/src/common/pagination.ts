export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function normalizePagination(page?: number, limit?: number) {
  const safePage = Number.isFinite(page) && (page as number) > 0 ? Math.floor(page as number) : DEFAULT_PAGE;
  const rawLimit = Number.isFinite(limit) && (limit as number) > 0 ? Math.floor(limit as number) : DEFAULT_LIMIT;
  const safeLimit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, skip };
}

export function paginatedResponse<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
