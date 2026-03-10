import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

interface User {
  id: number;
  nombre: string;
  email: string;
  categoria: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, clave: string) => Promise<void>;
  registerStep1: (data: RegisterStep1Data) => Promise<number>;
  registerStep2: (data: RegisterStep2Data) => Promise<void>;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterStep1Data {
  documento: string;
  nombre: string;
  direccion: string;
  numeroPais: number;
}

interface RegisterStep2Data {
  identificador: number;
  email: string;
  clave: string;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, clave) => {
    const { data } = await api.post('/auth/login', { email, clave });
    await SecureStore.setItemAsync('accessToken', data.data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
    set({ user: data.data.user, isAuthenticated: true });
  },

  registerStep1: async (formData) => {
    const { data } = await api.post('/auth/register/step1', formData);
    return data.data.identificador;
  },

  registerStep2: async (formData) => {
    await api.post('/auth/register/step2', formData);
  },

  loadUser: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      const { data } = await api.get('/auth/me');
      set({
        user: {
          id: data.data.identificador,
          nombre: data.data.nombre,
          email: data.data.email,
          categoria: data.data.categoria,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    set({ user: null, isAuthenticated: false });
  },
}));
