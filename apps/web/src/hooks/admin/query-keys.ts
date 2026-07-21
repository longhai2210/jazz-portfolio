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
};
