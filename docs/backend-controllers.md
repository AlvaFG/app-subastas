# Backend Controllers

7 controllers en `server/src/controllers/`. Cada uno maneja un recurso.

---

## authController

Archivo: `controllers/authController.ts`

### registerStep1(req, res)

Registro etapa 1: crea registros en `personas` y `clientes`.

- Inserta en `personas`: documento, nombre, direccion, estado='activo'
- Inserta en `clientes`: identificador (del persona), numeroPais, admitido='si', categoria='comun', verificador (placeholder)
- Retorna el `identificador` generado

### registerStep2(req, res)

Registro etapa 2: establece email y clave.

- Busca cliente por `identificador`
- Hashea clave con bcrypt (salt rounds 10)
- Actualiza `clientes`: email, claveHash

### login(req, res)

Login con verificacion de multas.

- Busca cliente por email
- Compara clave con bcrypt
- Verifica que no tenga multas derivadas a justicia (`derivadaJusticia='si'`)
- Genera access token JWT (1h) y refresh token (7d)
- Guarda refresh en tabla `sesiones`
- Retorna tokens + datos del usuario

### refreshToken(req, res)

Rotacion de refresh token.

- Busca sesion activa con el refresh token
- Verifica que no haya expirado
- Genera nuevo par de tokens
- Invalida sesion anterior, crea nueva

### getMe(req, res)

Retorna perfil completo del usuario autenticado (personas + clientes JOIN).

---

## subastasController

Archivo: `controllers/subastasController.ts`

### getSubastas(req, res)

Lista subastas con paginacion y filtros.

- Query params: estado, categoria, page, limit
- SQL: OFFSET/FETCH NEXT para paginacion
- Incluye COUNT total para metadata
- JOIN con subastadores y personas para nombre del rematador

### getCatalogo(req, res)

Catalogo de items de una subasta.

- `optionalAuth`: sin token no muestra precioBase ni comision
- Con token: `categoryGuard` valida categoria del usuario >= categoria de la subasta
- JOIN: itemsCatalogo + productos + catalogos + duenios + personas

### getItemDetalle(req, res)

Detalle de un item individual.

- JOIN completo con producto, fotos, dueno, subasta
- Retorna array de IDs de fotos
- optionalAuth para precios condicionales

---

## mediosPagoController

Archivo: `controllers/mediosPagoController.ts`

### getMediosPago(req, res)

Lista todos los medios de pago activos del usuario (WHERE activo='si' AND cliente=userId).

### createMedioPago(req, res)

Crea medio de pago. Valida tipo (cuenta_bancaria, tarjeta_credito, cheque_certificado). Para cheques, establece montoDisponible = montoCheque.

### updateMedioPago(req, res)

Actualiza datos de un medio de pago. Verifica que pertenezca al usuario.

### deleteMedioPago(req, res)

Soft delete: SET activo='no'. Verifica ownership.

---

## multasController

Archivo: `controllers/multasController.ts`

### createMulta(req, res)

Crea multa del 10% por impago.

- `importeMulta = importeOriginal * 0.10`
- `fechaLimite = NOW + 72 horas`
- `derivadaJusticia = 'no'` (inicialmente)
- Crea notificacion de tipo 'multa'

### getMultas(req, res)

Lista todas las multas del usuario autenticado.

---

## ventaController

Archivo: `controllers/ventaController.ts`

### createSolicitud(req, res)

Crea solicitud de venta. Campos: descripcion, declaracionPropiedad (obligatorio). Estado inicial: 'pendiente'.

### getSolicitudes(req, res)

Lista solicitudes del usuario con estado y fechas.

### getSolicitudDetalle(req, res)

Detalle con JOIN a depositos y seguros si estan asociados.

### responderSolicitud(req, res)

Usuario acepta o rechaza el valor base propuesto. Body: `{ acepta: 'si' | 'no' }`.

### getCuentasVista(req, res)

Lista cuentas a la vista del usuario (JOIN duenios).

### createCuentaVista(req, res)

Crea cuenta destino para pagos. Campos: banco, numeroCuenta, cbu, moneda, pais.

---

## estadisticasController

Archivo: `controllers/estadisticasController.ts`

### getEstadisticas(req, res)

Queries agregadas:
- COUNT DISTINCT subastas asistidas (via asistentes)
- COUNT items ganados (pujos WHERE ganador='si')
- SUM importes pujados
- SUM importes pagados (registroDeSubasta)
- SUM comisiones
- GROUP BY categoria (subastas asistidas por categoria)
- COUNT multas totales e impagas

### getHistorialPujas(req, res)

Historial de pujas del usuario. Filtro opcional por subastaId (query param).

---

## notificacionesController

Archivo: `controllers/notificacionesController.ts`

### getNotificaciones(req, res)

Lista notificaciones del usuario ordenadas por fecha DESC.

### marcarLeida(req, res)

Marca notificacion como leida (SET leida='si'). Verifica ownership.

### getUnreadCount(req, res)

COUNT WHERE leida='no' AND cliente=userId.

### createWinnerNotification(clienteId, importe, comision, costoEnvio, moneda)

Funcion interna (no es endpoint). Llamada desde `auctionHandler` al cerrar un item con ganador. Crea notificacion tipo 'ganador' con desglose de importes.

---

## auctionHandler (Socket.IO)

Archivo: `socket/auctionHandler.ts`

No es un controller REST sino el handler de eventos Socket.IO. Documentado en detalle en [socket-io.md](socket-io.md).

### Estructuras de datos en memoria

```typescript
const userConnections = new Map<number, number>();  // userId -> subastaId
const activeItems = new Map<number, number>();       // subastaId -> itemId
```

### Logica de validacion de pujas

1. Obtener mejor puja actual del item
2. Verificar importe > mejor oferta
3. Calcular limites:
   - min = mejorOferta + (precioBase * 0.01)
   - max = mejorOferta + (precioBase * 0.20)
4. Si categoria de subasta es 'oro' o 'platino': skip limites
5. Verificar montoDisponible si unico medio de pago es cheque certificado
6. Crear registro `asistente` si no existe
7. INSERT INTO pujos
8. Broadcast `new-bid` a la sala
