import * as ImageManipulator from 'expo-image-manipulator';

// Reescala y comprime una imagen antes de mandarla en base64 al backend. Es clave
// en WEB, donde expo-image-picker ignora `quality` y devuelve la imagen a resolucion
// completa: sin esto, 6 fotos pueden superar el limite de payload del server.
const MAX_WIDTH = 1280;
const COMPRESS = 0.5;

/**
 * Devuelve el base64 (sin prefijo data:) de la imagen reescalada/comprimida.
 * Si la manipulacion falla, devuelve null para que el caller use el original.
 */
export async function compressToBase64(uri: string): Promise<string | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_WIDTH } }],
      { compress: COMPRESS, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    return result.base64 ?? null;
  } catch (e) {
    console.warn('compressToBase64 fallo, se usara el original:', e);
    return null;
  }
}
