import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './api';

// Cliente HTTP para la capa administrativa. Usa un token propio (rol empleado)
// guardado bajo una clave distinta a la del cliente, para no mezclar sesiones.
export const ADMIN_TOKEN_KEY = 'adminAccessToken';

const adminApi = axios.create({ baseURL: API_URL, timeout: 15000 });

adminApi.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ADMIN_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default adminApi;
