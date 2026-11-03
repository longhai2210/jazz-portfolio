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
    expect(ApiRoutes.settings.adminFeatures()).toBe('/settings/admin/features');
    expect(ApiRoutes.contact.submit()).toBe('/contact');
    expect(ApiRoutes.contact.adminList()).toBe('/admin/contact');
    expect(ApiRoutes.contact.adminList(2, 20)).toBe('/admin/contact?page=2&limit=20');
    expect(ApiRoutes.admin.stats()).toBe('/admin/stats');
  });

  it('builds blog public and admin paths', () => {
    expect(ApiRoutes.blog.publicList()).toBe('/blog/posts');
    expect(ApiRoutes.blog.publicList({ page: 2, limit: 10, tag: 'jazz' })).toBe(
      '/blog/posts?page=2&limit=10&tag=jazz',
    );
    expect(ApiRoutes.blog.publicBySlug('hello-world')).toBe('/blog/posts/hello-world');
    expect(ApiRoutes.blog.publicTags()).toBe('/blog/tags');
    expect(ApiRoutes.blog.commentToken('hello-world')).toBe(
      '/blog/posts/hello-world/comment-token',
    );
    expect(ApiRoutes.blog.publicComments('hello-world')).toBe(
      '/blog/posts/hello-world/comments',
    );
    expect(ApiRoutes.blog.publicComments('hello-world', 2)).toBe(
      '/blog/posts/hello-world/comments?page=2',
    );
    expect(ApiRoutes.blog.submitComment()).toBe('/blog/comments');

    expect(ApiRoutes.blog.adminList()).toBe('/blog/admin/posts');
    expect(ApiRoutes.blog.adminList({ page: 1, limit: 20, status: 'PUBLISHED' })).toBe(
      '/blog/admin/posts?page=1&limit=20&status=PUBLISHED',
    );
    expect(ApiRoutes.blog.adminCreate()).toBe('/blog/admin/posts');
    expect(ApiRoutes.blog.adminGet('p1')).toBe('/blog/admin/posts/p1');
    expect(ApiRoutes.blog.adminUpdate('p1')).toBe('/blog/admin/posts/p1');
    expect(ApiRoutes.blog.adminDelete('p1')).toBe('/blog/admin/posts/p1');
    expect(ApiRoutes.blog.adminPublish('p1')).toBe('/blog/admin/posts/p1/publish');
    expect(ApiRoutes.blog.adminUnpublish('p1')).toBe('/blog/admin/posts/p1/unpublish');
  });

  it('builds comment admin and blocklist paths', () => {
    expect(ApiRoutes.comments.adminList()).toBe('/admin/comments');
    expect(
      ApiRoutes.comments.adminList({ page: 1, status: 'PENDING', postId: 'p1' }),
    ).toBe('/admin/comments?page=1&status=PENDING&postId=p1');
    expect(ApiRoutes.comments.adminModerate('c1')).toBe('/admin/comments/c1/moderate');
    expect(ApiRoutes.comments.adminBulkModerate()).toBe('/admin/comments/bulk-moderate');
    expect(ApiRoutes.comments.adminDelete('c1')).toBe('/admin/comments/c1');
    expect(ApiRoutes.comments.adminBlocklist()).toBe('/admin/comments/blocklist');
    expect(ApiRoutes.comments.adminBlocklistDelete('b1')).toBe('/admin/comments/blocklist/b1');
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
