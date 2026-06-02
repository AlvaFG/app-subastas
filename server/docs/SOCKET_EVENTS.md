# Eventos Socket.IO — Subasta en vivo

Las pujas y el estado de la subasta en vivo se manejan por **Socket.IO**, no por REST
(el Swagger documenta solo el contrato REST). Este documento es el contrato de los
eventos en tiempo real (A3 de la devolución).

## Conexión y autenticación

El cliente se conecta enviando el **access token JWT** en el handshake:

```js
io(API_URL, { auth: { token: accessToken } })
```

El servidor valida el token en un middleware (`io.use`). Sin token válido la conexión
se rechaza con `Error('Token requerido' | 'Token invalido')`. El `socket.user` resultante
(`{ id, email, categoria, ... }`) identifica al postor en todos los eventos.

Restricción (TPO §137): un usuario **no puede estar conectado a más de una subasta a la
vez** (`userConnections` lo controla en `join-auction`).

---

## Eventos cliente → servidor (con callback de ack)

Cada uno responde por callback con `{ success: boolean, data?, error?, code? }`.

### `join-auction(subastaId, cb)`
Une al socket a la sala de la subasta (si está `abierta`). Devuelve el estado actual.

- **ack.data**: `{ canBid, reasonCode, reason, currentBid, moneda }`
  - `canBid` (boolean): si el usuario puede pujar.
  - `reasonCode` (string|null): código estable del bloqueo (ver tabla abajo).
  - `reason` (string|null): mensaje legible del bloqueo.
  - `currentBid`: `{ item, bestBid, totalBids } | null`.
- **errores**: `'Subasta no encontrada o cerrada'`, `'Ya estas conectado a otra subasta...'`.

#### Códigos de bloqueo (`reasonCode`)
| code | significado |
|------|-------------|
| `BLOCKED_INACTIVITY` | Cuenta bloqueada (p. ej. impago derivado a justicia). |
| `REGISTRATION_INCOMPLETE` | El registro aún no fue admitido por la empresa. |
| `UNPAID_PENALTY` | Tiene multas impagas. |
| `CATEGORY_INSUFFICIENT` | Su categoría no alcanza para esta subasta. |
| `PAYMENT_METHOD_MISSING` | No tiene ningún medio de pago. |
| `PAYMENT_METHOD_UNVERIFIED` | Tiene medio(s) pero ninguno verificado por la empresa. |
| `null` | Sin bloqueo: puede pujar. |

### `place-bid({ subastaId, itemId, importe }, cb)`
Registra una puja. Valida en transacción atómica: cuenta activa, sin multas, categoría,
moneda/medio compatible, fondos (garantía de cheque), y límites min/max
(última + 1% base ≤ puja ≤ última + 20% base; sin límite para oro/platino).

- **ack.data**: `{ bidId }`.
- **errores**: monto inválido, no conectado, item vendido, categoría, fondos insuficientes, fuera de límites, etc.
- Emite `new-bid` a la sala al confirmar.

### `confirm-payment({ itemId, medioPagoId, modoEntrega }, cb)`
El ganador paga la pieza. `modoEntrega ∈ {'envio','retiro'}` (TPO §125: el **retiro
personal** anula el costo de envío y **pierde la cobertura del seguro**).

- **ack.data**: `{ totalPagado, modoEntrega, costoEnvio }`.
- Si no hay fondos: `{ success:false, error, code:'MULTA_APLICADA' }` (genera multa 10%, 72hs).
- Emite `item-sold` y notifica al ganador.

### `cancel-payment({ itemId }, cb)`
El ganador cancela el pago; se reabre el item con la oferta previa o vuelve al precio base.

### `close-item({ subastaId, itemId }, cb)`
**Solo el subastador** de la subasta. Cierra el item y determina ganador. (No expuesto al comprador.)

### `set-active-item({ subastaId, itemId }, cb)`
**Solo el subastador**. Cambia el item activo de la subasta.

### `leave-auction(subastaId)`
Sale de la sala y libera la conexión del usuario (sin ack).

---

## Eventos servidor → cliente (broadcast a la sala)

| evento | payload | descripción |
|--------|---------|-------------|
| `active-item-changed` | `{ itemId }` | Cambió el item en subasta. |
| `new-bid` | `{ bidId, itemId, importe, postorId, postorNombre, timestamp }` | Nueva puja aceptada. |
| `item-close-scheduled` | `{ itemId, closeInMs }` | Cierre por inactividad programado tras la última puja. |
| `item-no-bid-scheduled` | `{ itemId, closeInMs }` | Compra automática de la empresa programada si nadie puja. |
| `item-no-bids` | `{ itemId, compraEmpresa }` | Nadie pujó: la empresa compra a precio base (TPO §189). |
| `item-closed` | `{ itemId, ganadorId, ganadorNombre, importe, pendientePago }` | Item cerrado, a la espera de pago. |
| `you-won` | `{ itemId, importe, comision, costoEnvio, total, moneda, medios }` | **Solo al ganador**: desglose y medios disponibles. |
| `item-sold` | `{ itemId, ganadorId, ganadorNombre, importe, comision, costoEnvio, modoEntrega }` | Pago confirmado. |
| `item-payment-defaulted` | `{ itemId, subastaId, multa, fechaLimite }` | El ganador no tenía fondos: multa aplicada. |
| `item-payment-cancelled` | `{ itemId, bestBid, bestBidder, bestBidderId, bidId, closeInMs }` | Pago cancelado, item reabierto. |
| `auction-closed` | `{ subastaId }` | No quedan items: subasta cerrada. |
| `user-joined` / `user-left` | `{ userId, nombre? }` | Presencia en la sala. |

---

## Flujo típico

```
join-auction → active-item-changed → new-bid (xN) → item-close-scheduled
  → item-closed → you-won → confirm-payment → item-sold → active-item-changed (siguiente)
  → ... → auction-closed
```
