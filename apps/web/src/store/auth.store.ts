import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '@/lib/api';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  rating: number;
  problemsSolved: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isHydrated: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.login({ email, password });
          const { token, rating, problemsSolved, ...rest } = res.data as typeof res.data & { rating?: number; problemsSolved?: number };
          const user: AuthUser = { ...rest, rating: rating ?? 1200, problemsSolved: problemsSolved ?? 0 };
          localStorage.setItem('vyro_token', token);
          set({ user, token, isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Login failed',
            isLoading: false,
          });
          throw err;
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await authApi.register({ username, email, password });
          const { token, rating, problemsSolved, ...rest } = res.data as typeof res.data & { rating?: number; problemsSolved?: number };
          const user: AuthUser = { ...rest, rating: rating ?? 1200, problemsSolved: problemsSolved ?? 0 };
          localStorage.setItem('vyro_token', token);
          set({ user, token, isLoading: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Registration failed',
            isLoading: false,
          });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem('vyro_token');
        set({ user: null, token: null, error: null });
      },

      fetchMe: async () => {
        const { token } = get();
        if (!token) {
          set({ isHydrated: true });
          return;
        }
        try {
          const res = await authApi.me();
          set({ user: res.data, isHydrated: true });
        } catch (err) {
          // Only clear auth on 401, not network errors
          const isUnauthorized =
            err instanceof Error &&
            (err.message.includes('401') || err.message.toLowerCase().includes('unauthorized'));
          if (isUnauthorized) {
            localStorage.removeItem('vyro_token');
            set({ user: null, token: null, isHydrated: true });
          } else {
            // Network error — keep existing state, just mark hydrated
            set({ isHydrated: true });
          }
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'vyro-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      // After rehydration from localStorage, set isHydrated = true if no token
      // (if there is a token, fetchMe will set it after verifying)
      onRehydrateStorage: () => (state) => {
        if (state && !state.token) {
          state.isHydrated = true;
        }
      },
    }
  )
);
