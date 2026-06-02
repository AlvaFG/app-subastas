import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import adminApi, { ADMIN_TOKEN_KEY } from '../services/adminApi';

interface AdminUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

interface AdminState {
  admin: AdminUser | null;
  isAdminAuth: boolean;
  login: (email: string, clave: string) => Promise<void>;
  logout: () => Promise<void>;
  loadAdmin: () => Promise<boolean>;
}

export const useAdminStore = create<AdminState>((set) => ({
  admin: null,
  isAdminAuth: false,

  login: async (email, clave) => {
    const { data } = await adminApi.post('/auth/admin/login', { email, clave });
    await SecureStore.setItemAsync(ADMIN_TOKEN_KEY, data.data.accessToken);
    set({ admin: data.data.user, isAdminAuth: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(ADMIN_TOKEN_KEY);
    set({ admin: null, isAdminAuth: false });
  },

  loadAdmin: async () => {
    const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
    const authed = !!token;
    set({ isAdminAuth: authed });
    return authed;
  },
}));
