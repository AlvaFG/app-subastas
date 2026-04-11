# Arquitectura del Sistema

## Diagrama General

```
+-------------------+          +-------------------+          +-------------------+
|                   |  REST    |                   |  mssql   |                   |
|   React Native    | -------> |   Express API     | -------> |   SQL Server      |
|   (Expo)          | <------- |   (Node.js)       | <------- |   (23 tablas)     |
|                   |  JSON    |                   |  Queries |                   |
|                   |          |                   |          +-------------------+
|                   | Socket.IO|                   |
|                   | <------> |   Socket.IO       |
|                   | Events   |   (auctionHandler)|
+-------------------+          +-------------------+
                                        |
                                        v
                               +-------------------+
                               |   Cloudinary      |
                               |   (imagenes)      |
                               +-------------------+
```

## Patron MVC

El backend sigue un patron MVC adaptado:

```
Request -> Route -> Controller -> Model (db queries) -> Response
                       |
                    Service (logica de negocio)
```

- **Routes:** Definen endpoints y aplican middleware (auth, validacion)
- **Controllers:** Manejan request/response, orquestan logica
- **Models:** `db.ts` provee el connection pool de mssql. Los queries SQL estan en los controllers directamente.
- **Middleware:** Funciones intermedias (auth, validacion, rate limiting)

## Middleware Pipeline

El orden de middleware global en `server/src/index.ts`:

```
Request
  |-> cors()                    # CORS para origenes configurados
  |-> helmet()                  # Headers de seguridad (X-Frame-Options, CSP, etc.)
  |-> morgan('dev')             # Logging HTTP (metodo, ruta, status, tiempo)
  |-> express.json()            # Parse body JSON
  |-> express.urlencoded()      # Parse form data
  |-> [Route middleware]         # authGuard, categoryGuard, validate (por ruta)
  |-> Controller
  |-> Response
```

### Middleware Custom

| Middleware | Archivo | Funcion |
|-----------|---------|---------|
| `authGuard` | middleware/auth.ts | Verifica JWT Bearer token, extrae payload del usuario |
| `categoryGuard(min)` | middleware/auth.ts | Verifica que la categoria del usuario sea >= minima requerida |
| `optionalAuth` | middleware/auth.ts | Extrae usuario si hay token, pero no bloquea sin token |
| `validate` | middleware/validate.ts | Ejecuta express-validator y retorna errores 400 |
| `authLimiter` | routes/auth.ts | Rate limit: 15 requests / 15 minutos en rutas /auth |

## Socket.IO

### Arquitectura de Rooms

```
Servidor Socket.IO
  |
  |-- Room: auction-{subastaId}
  |     |-- Usuario A (postor)
  |     |-- Usuario B (postor)
  |     |-- Subastador (admin)
  |
  |-- Room: auction-{otraSubastaId}
        |-- Usuario C
```

- Cada subasta activa tiene un room `auction-{id}`
- Un usuario solo puede estar en 1 room a la vez (Map `userConnections`)
- El subastador tiene permisos admin (close-item, set-active-item)

### Flujo de Eventos

```
Cliente                    Servidor                   Otros Clientes
  |                           |                           |
  |-- join-auction ---------->|                           |
  |                           |-- user-joined ----------->|
  |<-- (current item data) ---|                           |
  |                           |                           |
  |-- place-bid ------------->|                           |
  |                           |-- [validar bid] ------    |
  |                           |-- new-bid --------------->|
  |<-- (callback ok) ---------|                           |
  |                           |                           |
  |        [Subastador]       |                           |
  |-- close-item ------------>|                           |
  |                           |-- item-sold ------------->|
  |                           |-- you-won --------------->| (solo ganador)
  |                           |                           |
  |-- leave-auction --------->|                           |
  |                           |-- user-left ------------->|
```

### Auth en Socket

El middleware de Socket.IO extrae el JWT del handshake:

```typescript
socket.handshake.auth.token -> jwt.verify() -> socket.data.user
```

## Monorepo

```
proyecto/
  app/          # Frontend independiente (package.json propio)
  server/       # Backend independiente (package.json propio)
  docs/         # Documentacion
```

No se usa un monorepo tool (Turborepo, Nx). Cada directorio se instala y ejecuta por separado.
