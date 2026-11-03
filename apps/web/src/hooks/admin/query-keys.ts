export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  categories: () => [...adminKeys.all, 'categories'] as const,
  tracks: () => [...adminKeys.all, 'tracks'] as const,
  profile: () => [...adminKeys.all, 'profile'] as const,
  contact: () => [...adminKeys.all, 'contact'] as const,
  contactList: (page: number, limit: number) =>
    [...adminKeys.contact(), 'list', page, limit] as const,
  contactDetail: (id: string) => [...adminKeys.contact(), 'detail', id] as const,
  settingsEmail: () => [...adminKeys.all, 'settings', 'email'] as const,
  settingsFeatures: () => [...adminKeys.all, 'settings', 'features'] as const,
  posts: () => [...adminKeys.all, 'posts'] as const,
  postList: (page: number, limit: number, status?: string) =>
    [...adminKeys.posts(), 'list', page, limit, status ?? 'ALL'] as const,
  postDetail: (id: string) => [...adminKeys.posts(), 'detail', id] as const,
  comments: () => [...adminKeys.all, 'comments'] as const,
  commentList: (page: number, limit: number, status: string) =>
    [...adminKeys.comments(), 'list', page, limit, status] as const,
  blocklist: () => [...adminKeys.comments(), 'blocklist'] as const,
};
