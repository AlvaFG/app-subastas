import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

function parseHost(raw?: string): string | null {
  if (!raw) return null;

  const fromUrl = raw.match(/^https?:\/\/([^/:]+)/i)?.[1];
  if (fromUrl) return fromUrl;

  const fromHostPort = raw.split(':')[0];
  return fromHostPort || null;
}

function toApiUrl(host: string): string {
  if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
    return 'http://10.0.2.2:3000/api';
  }
  return `http://${host}:3000/api`;
}

function resolveApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl && envUrl.toLowerCase() !== 'auto') return envUrl;

  // Most reliable in dev: host used by the running JS bundle.
  const scriptHost = parseHost(NativeModules?.SourceCode?.scriptURL);
  if (scriptHost) return toApiUrl(scriptHost);

  // Expo fallbacks across SDK/runtime variants.
  const anyConstants = Constants as any;
  const expoHost = parseHost(
    Constants.expoConfig?.hostUri ||
    anyConstants?.expoGoConfig?.debuggerHost ||
    anyConstants?.manifest2?.extra?.expoClient?.hostUri ||
    anyConstants?.manifest?.debuggerHost,
  );

  if (expoHost) return toApiUrl(expoHost);
  if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api';
  return 'http://localhost:3000/api';
}

export const API_URL = resolveApiUrl();
console.info(`[api] baseURL=${API_URL}`);

const api = axios.create({ baseURL: API_URL });

// Interceptor: agregar token a cada request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: renovar token si expiro
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;

        await SecureStore.setItemAsync('accessToken', newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return api(originalRequest);
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        // El store detectara que no hay token y redirigira a login
      }
    }

    return Promise.reject(error);
  },
);

export default api;
