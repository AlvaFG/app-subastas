# Protocolo Socket.IO — Subastas en Tiempo Real

## Conexion

```typescript
const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  auth: { token: '<JWT access token>' }
});
```

El middleware de Socket.IO verifica el JWT del handshake. Si es invalido, la conexion se rechaza.

## Eventos

### Cliente -> Servidor

#### `join-auction`

Unirse a una sala de subasta.

```typescript
socket.emit('join-auction', { subastaId: 1 }, (response) => {
  // response: { success: true, data: { currentItem, bestBid, participants } }
  // o: { success: false, error: "..." }
});
```

**Validaciones:**
- Usuario autenticado (JWT valido)
- No estar conectado a otra subasta (max 1 simultanea)
- Categoria del usuario >= categoria de la subasta
- Tener al menos 1 medio de pago activo para poder pujar
- No tener multas impagas derivadas a justicia

#### `place-bid`

Enviar una puja.

```typescript
socket.emit('place-bid', {
  subastaId: 1,
  itemId: 10,
  importe: 55000.00
}, (response) => {
  // response: { success: true, data: { bidId, importe } }
  // o: { success: false, error: "Puja debe ser mayor a ..." }
});
```

**Validaciones:**
- Importe > mejor oferta actual
- Importe >= mejor oferta + 1% del precio base (minimo)
- Importe <= mejor oferta + 20% del precio base (maximo)
- Limites min/max **no aplican** para subastas oro y platino
- Si tiene cheque certificado como unico medio de pago: importe <= montoDisponible
- Importe no puede ser NaN ni negativo

#### `close-item`

Cerrar la puja de un item (solo subastador/admin).

```typescript
socket.emit('close-item', { subastaId: 1, itemId: 10 }, (response) => {
  // response: { success: true, data: { winner, importe } }
});
```

**Logica:**
- Si hay pujas: el mayor postor gana. Se registra en `registroDeSubasta`, se marca `subastado='si'`, se crea notificacion al ganador
- Si no hay pujas: la empresa compra al precio base (T606)
- Si el ganador tiene cheque certificado: se descuenta `montoDisponible`

#### `set-active-item`

Cambiar el item activo de la subasta (solo subastador/admin).

```typescript
socket.emit('set-active-item', { subastaId: 1, itemId: 11 });
```

#### `leave-auction`

Salir de la sala.

```typescript
socket.emit('leave-auction', { subastaId: 1 });
```

---

### Servidor -> Cliente (Broadcast)

#### `new-bid`

Se emite a todos en la sala cuando se recibe una puja valida.

```typescript
socket.on('new-bid', (data) => {
  // data: { bidId, itemId, importe, postorNombre, timestamp }
});
```

#### `item-sold`

Se emite cuando el subastador cierra un item con ganador.

```typescript
socket.on('item-sold', (data) => {
  // data: { itemId, ganadorNombre, importe, comision }
});
```

#### `you-won`

Mensaje privado solo al ganador.

```typescript
socket.on('you-won', (data) => {
  // data: { itemId, importe, comision, costoEnvio, moneda }
});
```

#### `item-no-bids`

Se emite cuando un item se cierra sin pujas (la empresa lo compra).

```typescript
socket.on('item-no-bids', (data) => {
  // data: { itemId, precioBase }
});
```

#### `active-item-changed`

Se emite cuando el subastador cambia el item activo.

```typescript
socket.on('active-item-changed', (data) => {
  // data: { itemId, precioBase, descripcionCatalogo }
});
```

#### `user-joined` / `user-left`

Notificacion cuando un usuario entra o sale de la sala.

```typescript
socket.on('user-joined', (data) => { /* { userId, nombre } */ });
socket.on('user-left', (data) => { /* { userId, nombre } */ });
```

---

## Diagramas de Flujo

### Flujo completo de subasta

```
1. Usuarios se conectan
   join-auction -> [validar categoria, medios pago, multas]
                -> user-joined (broadcast)

2. Subastador activa item
   set-active-item -> active-item-changed (broadcast)

3. Postores pujan
   place-bid -> [validar min/max, cheque, NaN]
             -> new-bid (broadcast a todos)
             -> callback al postor (confirmacion)

4. Subastador cierra item
   close-item -> item-sold (broadcast)
              -> you-won (privado al ganador)
              -> [registrar venta, notificacion, deducir cheque]

   O si no hay pujas:
   close-item -> item-no-bids (broadcast)
              -> [empresa compra a precio base]

5. Repetir desde paso 2 para siguiente item

6. Usuarios se desconectan
   leave-auction / disconnect -> user-left (broadcast)
```

### Restricciones

- **1 subasta por usuario:** El Map `userConnections` rastrea a que subasta esta conectado cada usuario. Si intenta unirse a otra, se rechaza.
- **Pujas bloqueantes:** La app no permite enviar otra puja hasta recibir el callback de confirmacion del servidor.
- **Moneda:** El medio de pago debe soportar la moneda de la subasta (o ser internacional para subastas USD).
