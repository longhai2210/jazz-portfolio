import { create } from 'zustand';

interface AuthState {
  username: string | null;
  isAuthenticated: boolean;
  /** Session bootstrap from /auth/me has finished at least once. */
  hydrated: boolean;

  setSession: (username: string) => void;
  clearSession: () => void;
  setHydrated: (hydrated: boolean) => void;
}

/**
 * Client-side admin session identity only — JWT is httpOnly on the API host.
 * Not persisted to localStorage (no token / Bearer leakage).
 */
export const useAuthStore = create<AuthState>((set) => ({
  username: null,
  isAuthenticated: false,
  hydrated: false,

  setSession: (username) =>
    set({ username, isAuthenticated: true, hydrated: true }),
  clearSession: () =>
    set({ username: null, isAuthenticated: false, hydrated: true }),
  setHydrated: (hydrated) => set({ hydrated }),
}));
