/**
 * Almacenamiento de credenciales multiplataforma.
 *
 * - Nativo (iOS/Android): expo-secure-store (cifrado, keychain/keystore).
 * - Web: localStorage (expo-secure-store no tiene implementacion web).
 *
 * Expone la misma API que SecureStore (getItemAsync/setItemAsync/deleteItemAsync)
 * para ser un reemplazo directo en los servicios y stores de auth.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const hasLocalStorage = () => typeof localStorage !== 'undefined';

export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) return hasLocalStorage() ? localStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (hasLocalStorage()) localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    if (hasLocalStorage()) localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
