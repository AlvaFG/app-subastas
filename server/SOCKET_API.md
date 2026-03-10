# Socket.IO — API de Subasta en Tiempo Real

**Conexión:** `ws://localhost:3000` con auth token en handshake:
```js
const socket = io('http://localhost:3000', {
  auth: { token: 'JWT_ACCESS_TOKEN' }
});
```

## Eventos Cliente → Servidor

### `join-auction`
Unirse a la sala de una subasta.
- **Datos:** `subastaId: number`
- **Callback:** `{ success, data: { canBid, reason?, currentBid?, moneda } }`
- **Errores:**
  - Ya conectado a otra subasta (restricción 1 subasta simultánea)
  - Subasta no encontrada o cerrada
  - Categoría insuficiente
- **Códigos equivalentes:** 200 OK, 403 Forbidden, 404 Not Found

### `place-bid`
Enviar una puja.
- **Datos:** `{ subastaId: number, itemId: number, importe: number }`
- **Callback:** `{ success, data?: { bidId }, error? }`
- **Validaciones:**
  - `importe` debe ser finito y positivo
  - `importe > mejorPujaActual`
  - Categorías comun/especial/plata: `min = última + 1% base`, `max = última + 20% base`
  - Categorías oro/platino: sin límite min/max
  - Medio de pago compatible con moneda de la subasta (`moneda` match o `internacional = 'si'`)
  - Cheque certificado: importe no supera `montoDisponible`
  - Sin multas impagas
- **Códigos equivalentes:** 200 OK, 400 Bad Request, 403 Forbidden

### `close-item`
Cerrar un item (solo subastador).
- **Datos:** `{ subastaId: number, itemId: number }`
- **Callback:** `{ success, data: { ganador?, importe?, noBids?, compraEmpresa? } }`
- **Lógica:**
  - Con pujas: marca ganador, registra venta, deduce cheque, notifica ganador
  - Sin pujas (T606): empresa compra a precio base
- **Códigos equivalentes:** 200 OK, 403 Forbidden (no es subastador)

### `set-active-item`
Cambiar item activo en la subasta (solo subastador).
- **Datos:** `{ subastaId: number, itemId: number }`
- **Callback:** `{ success }`
- **Códigos equivalentes:** 200 OK, 403 Forbidden

### `leave-auction`
Salir de la subasta.
- **Datos:** `subastaId: number`

## Eventos Servidor → Cliente

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `new-bid` | `{ bidId, itemId, importe, postorId, postorNombre, timestamp }` | Nueva puja recibida (broadcast a toda la sala) |
| `item-sold` | `{ itemId, ganadorId, ganadorNombre, importe, comision }` | Item vendido (broadcast) |
| `item-no-bids` | `{ itemId, compraEmpresa: true }` | Nadie pujó, empresa compra (broadcast) |
| `you-won` | `{ itemId, importe, comision, mensaje }` | Notificación privada al ganador |
| `active-item-changed` | `{ itemId }` | Cambio de item en subasta (broadcast) |
| `user-joined` | `{ userId, nombre }` | Usuario se unió (broadcast) |
| `user-left` | `{ userId }` | Usuario se fue (broadcast) |

## Autenticación Socket
- JWT se verifica en middleware de conexión
- Token inválido/expirado: `Error('Token invalido')`
- Token ausente: `Error('Token requerido')`

## Códigos HTTP Referencia (IANA)
Según https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml

| Código | Nombre | Uso en esta API |
|--------|--------|-----------------|
| 200 | OK | Operación exitosa (GET, PUT, login) |
| 201 | Created | Recurso creado (POST registro, medio pago, solicitud) |
| 400 | Bad Request | Validación fallida, datos incompletos |
| 401 | Unauthorized | Token faltante, inválido o expirado |
| 403 | Forbidden | Categoría insuficiente, cuenta bloqueada, no es subastador |
| 404 | Not Found | Recurso no encontrado o no pertenece al usuario |
| 429 | Too Many Requests | Rate limit excedido en /api/auth (15 req/15 min) |
| 500 | Internal Server Error | Error de servidor no controlado |
