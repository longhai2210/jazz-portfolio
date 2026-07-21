import { ApiRoutes, buildReorderIds } from './api-routes';

describe('ApiRoutes', () => {
  it('builds Nest-aligned auth and profile paths', () => {
    expect(ApiRoutes.auth.login()).toBe('/auth/login');
    expect(ApiRoutes.auth.logout()).toBe('/auth/logout');
    expect(ApiRoutes.auth.me()).toBe('/auth/me');
    expect(ApiRoutes.profile.public()).toBe('/profile');
    expect(ApiRoutes.profile.adminUpdate()).toBe('/profile/admin/update');
    expect(ApiRoutes.profile.adminPassword()).toBe('/profile/admin/password');
  });

  it('keeps category admin routes under /categories/admin/* (not /admin/categories)', () => {
    expect(ApiRoutes.categories.adminAll()).toBe('/categories/admin/all');
    expect(ApiRoutes.categories.adminCreate()).toBe('/categories/admin/create');
    expect(ApiRoutes.categories.adminUpdate('c1')).toBe('/categories/admin/c1');
    expect(ApiRoutes.categories.adminDelete('c1')).toBe('/categories/admin/c1');
    expect(ApiRoutes.categories.adminReorder()).toBe('/categories/admin/reorder');
    expect(ApiRoutes.categories.adminCreateItem('c1')).toBe('/categories/admin/c1/items');
    expect(ApiRoutes.categories.adminUpdateItem('i1')).toBe('/categories/admin/items/i1');
    expect(ApiRoutes.categories.adminDeleteItem('i1')).toBe('/categories/admin/items/i1');
    expect(ApiRoutes.categories.adminReorderItems()).toBe('/categories/admin/items/reorder');
  });

  it('builds music, media, settings, contact, and stats paths', () => {
    expect(ApiRoutes.music.public()).toBe('/music');
    expect(ApiRoutes.music.adminAll()).toBe('/music/admin/all');
    expect(ApiRoutes.media.adminPresign()).toBe('/media/admin/presign');
    expect(ApiRoutes.settings.public()).toBe('/settings/public');
    expect(ApiRoutes.contact.submit()).toBe('/contact');
    expect(ApiRoutes.contact.adminList()).toBe('/admin/contact');
    expect(ApiRoutes.contact.adminList(2, 20)).toBe('/admin/contact?page=2&limit=20');
    expect(ApiRoutes.admin.stats()).toBe('/admin/stats');
  });
});

describe('buildReorderIds', () => {
  it('swaps adjacent ids for up/down moves', () => {
    expect(buildReorderIds(['a', 'b', 'c'], 1, 'up')).toEqual(['b', 'a', 'c']);
    expect(buildReorderIds(['a', 'b', 'c'], 1, 'down')).toEqual(['a', 'c', 'b']);
  });

  it('returns null at list boundaries', () => {
    expect(buildReorderIds(['a', 'b'], 0, 'up')).toBeNull();
    expect(buildReorderIds(['a', 'b'], 1, 'down')).toBeNull();
  });
});
