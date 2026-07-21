import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light-jazz';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        if (typeof window !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
        }
      },
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light-jazz' : 'dark';
          if (typeof window !== 'undefined') {
            document.documentElement.setAttribute('data-theme', newTheme);
          }
          return { theme: newTheme };
        }),
    }),
    {
      name: 'jazz-theme-storage',
    }
  )
);
