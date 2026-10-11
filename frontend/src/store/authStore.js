/**
 * DirectMarket - Store Global de Autenticacion
 * Usa Zustand para manejo de estado simple y reactivo.
 * RF-01: sesion del usuario, token JWT, rol.
 */

import { create } from 'zustand';

const getStoredUser = () => {
  try {
    const stored = localStorage.getItem('dm_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const useAuthStore = create((set) => ({
  user: getStoredUser(),
  token: localStorage.getItem('dm_token') || null,
  isAuthenticated: !!localStorage.getItem('dm_token'),

  setAuth: (user, token) => {
    localStorage.setItem('dm_token', token);
    localStorage.setItem('dm_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  updateUser: (updates) => {
    set((state) => {
      const updated = { ...state.user, ...updates };
      localStorage.setItem('dm_user', JSON.stringify(updated));
      return { user: updated };
    });
  },

  logout: () => {
    localStorage.removeItem('dm_token');
    localStorage.removeItem('dm_user');
    set({ user: null, token: null, isAuthenticated: false });
  }
}));

export default useAuthStore;
