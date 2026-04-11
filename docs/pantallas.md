# Pantallas

## Mapa de Rutas

| Ruta | Pantalla | Descripcion |
|------|----------|-------------|
| `(auth)/login` | Login | Fondo ink, campos email/clave, boton dorado |
| `(auth)/register/step1` | Registro Etapa 1 | Formulario scroll: nombre, documento, direccion, pais |
| `(auth)/register/step2` | Registro Etapa 2 | ID + email + clave + confirmacion |
| `(tabs)/index` | Subastas (Home) | Lista de subastas con filtros (todas/abierta/cerrada), pull-to-refresh |
| `(tabs)/catalogo` | Catalogo | Redirect a subastas |
| `(tabs)/vender` | Vender | Tabs: nueva solicitud / mis solicitudes |
| `(tabs)/perfil` | Perfil | Avatar, badge categoria, datos, medios de pago, logout |
| `subasta/[id]` | Catalogo Subasta | Grid 2 columnas con Cards, precio condicional (auth) |
| `subasta/[id]/live` | Subasta en Vivo | Full screen dark, precio Playfair hero gold, lista pujas, pulse animation |
| `item/[id]` | Detalle Item | Gallery, precio gold, descripcion, info dueno y subasta |
| `estadisticas` | Estadisticas | Dashboard: asistidas, ganadas, historial pujas, importes |
| `notificaciones` | Notificaciones | Lista con badge count, marcar como leida |

## Flujos de Navegacion

### Auth Flow

```
App Launch
  |-> loadUser() (token en SecureStore?)
  |     |-> Si: (tabs)/ (home)
  |     |-> No: (auth)/login
  |
  (auth)/login
  |-> "Registrarse" -> (auth)/register/step1
  |-> Login exitoso -> (tabs)/
  |
  (auth)/register/step1
  |-> Submit -> (auth)/register/step2
  |
  (auth)/register/step2
  |-> Submit -> (auth)/login (con mensaje de exito)
```

### Browse Flow

```
(tabs)/index (lista subastas)
  |-> Tap subasta -> subasta/[id] (catalogo)
  |     |-> Tap item -> item/[id] (detalle)
  |     |-> "Unirse" -> subasta/[id]/live (subasta en vivo)
```

### Live Auction Flow

```
subasta/[id]/live
  |-> Socket: join-auction
  |-> Ver item activo + mejor oferta
  |-> Ingresar monto -> place-bid
  |-> Recibir new-bid (actualizar UI)
  |-> item-sold / you-won -> Modal resultado
  |-> active-item-changed -> Actualizar item
  |-> leave-auction -> Volver a catalogo
```

### Sell Flow

```
(tabs)/vender
  |-> Tab "Nueva Solicitud"
  |     |-> Formulario: descripcion, fotos (min 6), declaracion propiedad
  |     |-> Submit -> POST /venta/solicitudes
  |
  |-> Tab "Mis Solicitudes"
        |-> Lista con estado (pendiente/aceptada/rechazada/devuelta)
        |-> Tap -> Detalle: valor base, comision, deposito, seguro
        |-> "Aceptar" / "Rechazar" valor -> PUT /venta/solicitudes/:id/respuesta
```

## Componentes Usados por Pantalla

| Pantalla | Componentes |
|----------|-------------|
| Login | Input, Button (primary) |
| Register Step 1 | Input, Button (primary), Avatar |
| Register Step 2 | Input, Button (primary) |
| Home (Subastas) | Card, Badge, Loading (CardSkeleton), Button (secondary) |
| Catalogo Subasta | Card, Badge, Loading |
| Subasta en Vivo | Button (primary/lg), Modal (bottom), Badge |
| Detalle Item | Badge, Button (primary), Loading |
| Perfil | Avatar (xl), Badge, Button (danger/ghost), Modal |
| Vender | Input, Button (primary), Modal |
| Estadisticas | Loading, Badge |
| Notificaciones | Loading, Badge |

## Endpoints por Pantalla

| Pantalla | Endpoints |
|----------|-----------|
| Login | POST /auth/login |
| Register Step 1 | POST /auth/register/step1 |
| Register Step 2 | POST /auth/register/step2 |
| Home | GET /subastas |
| Catalogo Subasta | GET /subastas/:id/catalogo |
| Detalle Item | GET /subastas/items/:id |
| Subasta en Vivo | Socket.IO (join, bid, close) |
| Perfil | GET /auth/me, GET /medios-pago, DELETE /medios-pago/:id |
| Vender | GET/POST /venta/solicitudes, PUT /venta/solicitudes/:id/respuesta, GET/POST /venta/cuentas |
| Estadisticas | GET /usuarios/estadisticas, GET /usuarios/historial-pujas |
| Notificaciones | GET /notificaciones, GET /notificaciones/count, PUT /notificaciones/:id/leer |
