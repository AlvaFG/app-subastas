/**
 * Feedback cross-platform. `Alert.alert` de react-native NO funciona de forma
 * confiable en web (react-native-web), asi que en web usamos window.alert/confirm
 * (que si funcionan) y en nativo el Alert de siempre.
 */
import { Alert, Platform } from 'react-native';

/** Aviso simple (un solo boton "OK"). */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/** Confirmacion (aceptar / cancelar). Ejecuta onConfirm si el usuario acepta. */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]);
  }
}
