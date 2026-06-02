/**
 * Extrae un mensaje de error legible a partir de un error desconocido
 * (tipicamente de axios). Tipado con unknown y narrowing, sin any.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback = 'Ocurrio un error',
): string {
  if (typeof err !== 'object' || err === null) {
    return fallback;
  }

  const candidate = err as {
    response?: { data?: { error?: unknown } };
    code?: unknown;
    message?: unknown;
  };

  const responseError = candidate.response?.data?.error;
  if (typeof responseError === 'string' && responseError.length > 0) {
    return responseError;
  }

  if (candidate.code === 'ECONNABORTED') {
    return 'La solicitud tardo demasiado. Reintente.';
  }

  if (
    typeof candidate.message === 'string' &&
    candidate.message.includes('Network')
  ) {
    return 'Sin conexion con el servidor.';
  }

  return fallback;
}
