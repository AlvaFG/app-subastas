# API REST

## Base URL

```
http://localhost:3000/api
```

## Formato de Respuesta

Todas las respuestas siguen el formato estandar:

```json
// Exito
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Mensaje descriptivo" }
```

## Autenticacion

- Tipo: **Bearer JWT**
- Header: `Authorization: Bearer <accessToken>`
- Access token: expira en **1 hora**
- Refresh token: expira en **7 dias**, almacenado en tabla `sesiones`
- Flujo de refresh: POST `/auth/refresh` con `{ refreshToken }` retorna nuevo par de tokens

## Rate Limiting

Las rutas `/api/auth` tienen rate limit de **15 requests por 15 minutos** por IP (deshabilitado en entorno `test`).

## Documentacion Interactiva

Swagger UI disponible en: `GET /api-docs`

OpenAPI JSON: `GET /api-docs.json`

---

## Endpoints

### Auth (`/api/auth`)

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 1 | POST | `/auth/register/step1` | No | Registro etapa 1: datos personales |
| 2 | POST | `/auth/register/step2` | No | Registro etapa 2: email y clave |
| 3 | POST | `/auth/login` | No | Login con email y clave |
| 4 | POST | `/auth/refresh` | No | Renovar access token |
| 5 | GET | `/auth/me` | Si | Obtener perfil del usuario autenticado |

#### POST `/auth/register/step1`

**Body:**
```json
{
  "documento": "12345678",
  "nombre": "Juan Perez",
  "direccion": "Av. Corrientes 1234",
  "numeroPais": 1
}
```

**Respuesta 201:**
```json
{ "success": true, "data": { "identificador": 5 } }
```

#### POST `/auth/register/step2`

**Body:**
```json
{
  "identificador": 5,
  "email": "juan@mail.com",
  "clave": "miPassword123"
}
```

**Respuesta 200:**
```json
{ "success": true, "data": { "message": "Registro completado" } }
```

#### POST `/auth/login`

**Body:**
```json
{
  "email": "juan@mail.com",
  "clave": "miPassword123"
}
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": 5, "nombre": "Juan Perez", "email": "juan@mail.com", "categoria": "comun" }
  }
}
```

**Errores:** 401 credenciales invalidas, 403 usuario bloqueado por multas impagas, 429 rate limit excedido.

#### POST `/auth/refresh`

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

#### GET `/auth/me`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "id": 5,
    "nombre": "Juan Perez",
    "email": "juan@mail.com",
    "categoria": "comun",
    "documento": "12345678",
    "direccion": "Av. Corrientes 1234",
    "admitido": "si"
  }
}
```

---

### Subastas (`/api/subastas`)

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 6 | GET | `/subastas` | Opcional | Listar subastas con filtros y paginacion |
| 7 | GET | `/subastas/:id/catalogo` | Opcional | Catalogo de items de una subasta |
| 8 | GET | `/subastas/items/:id` | Opcional | Detalle de un item |

#### GET `/subastas`

**Query params:**
- `estado` — `abierta` | `cerrada` (opcional)
- `categoria` — `comun` | `especial` | `plata` | `oro` | `platino` (opcional)
- `page` — Numero de pagina (default: 1)
- `limit` — Items por pagina (default: 10)

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "subastas": [
      {
        "identificador": 1,
        "fecha": "2026-04-15",
        "hora": "14:00",
        "estado": "abierta",
        "ubicacion": "Av. Libertador 4000",
        "categoria": "oro",
        "moneda": "ARS",
        "totalItems": 12,
        "subastadorNombre": "Carlos Reyes"
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 10
  }
}
```

#### GET `/subastas/:id/catalogo`

- Sin auth: no muestra `precioBase` ni `comision`
- Con auth: valida `categoryGuard` (categoria del usuario >= categoria de la subasta)

**Respuesta 200:**
```json
{
  "success": true,
  "data": [
    {
      "identificador": 10,
      "precioBase": 50000.00,
      "comision": 5000.00,
      "subastado": "no",
      "descripcionCatalogo": "Reloj Omega Seamaster 1965",
      "descripcionCompleta": "https://docs.example.com/item10.pdf",
      "duenioNombre": "Maria Lopez",
      "catalogoDescripcion": "Joyas y Relojes",
      "fotoId": 42
    }
  ]
}
```

#### GET `/subastas/items/:id`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "identificador": 10,
    "precioBase": 50000.00,
    "comision": 5000.00,
    "descripcionCatalogo": "Reloj Omega Seamaster 1965",
    "descripcionCompleta": "https://docs.example.com/item10.pdf",
    "duenioNombre": "Maria Lopez",
    "fotos": [42, 43, 44],
    "subasta": { "identificador": 1, "fecha": "2026-04-15", "moneda": "ARS" }
  }
}
```

---

### Medios de Pago (`/api/medios-pago`)

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 9 | GET | `/medios-pago` | Si | Listar medios de pago del usuario |
| 10 | POST | `/medios-pago` | Si | Crear medio de pago |
| 11 | PUT | `/medios-pago/:id` | Si | Actualizar medio de pago |
| 12 | DELETE | `/medios-pago/:id` | Si | Eliminar medio de pago (soft delete) |

#### POST `/medios-pago`

**Body:**
```json
{
  "tipo": "cuenta_bancaria",
  "descripcion": "Cuenta Santander",
  "banco": "Santander",
  "numeroCuenta": "123456789",
  "cbu": "0720000000012345678901",
  "moneda": "ARS"
}
```

Tipos validos: `cuenta_bancaria`, `tarjeta_credito`, `cheque_certificado`

Para cheque certificado, incluir `montoCheque` y `montoDisponible`.

**Respuesta 201:**
```json
{ "success": true, "data": { "identificador": 3 } }
```

---

### Multas (`/api/multas`)

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 13 | GET | `/multas` | Si | Ver multas del usuario |
| 14 | POST | `/multas` | Si | Crear multa (uso interno) |

#### POST `/multas`

Crea multa del 10% del importe original con deadline de 72 horas.

**Body:**
```json
{
  "clienteId": 5,
  "importeOriginal": 50000.00
}
```

---

### Venta (`/api/venta`)

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 15 | GET | `/venta/solicitudes` | Si | Listar solicitudes de venta |
| 16 | GET | `/venta/solicitudes/:id` | Si | Detalle de solicitud |
| 17 | POST | `/venta/solicitudes` | Si | Crear solicitud de venta |
| 18 | PUT | `/venta/solicitudes/:id/respuesta` | Si | Aceptar/rechazar valor base |
| 19 | GET | `/venta/cuentas` | Si | Listar cuentas a la vista |
| 20 | POST | `/venta/cuentas` | Si | Crear cuenta a la vista |

#### POST `/venta/solicitudes`

**Body:**
```json
{
  "descripcion": "Juego de te japones, 18 piezas, siglo XIX",
  "declaracionPropiedad": true
}
```

#### PUT `/venta/solicitudes/:id/respuesta`

**Body:**
```json
{ "acepta": "si" }
```

---

### Usuarios (`/api/usuarios`)

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 21 | GET | `/usuarios/estadisticas` | Si | Estadisticas del usuario |
| 22 | GET | `/usuarios/historial-pujas` | Si | Historial de pujas |

#### GET `/usuarios/estadisticas`

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "subastasAsistidas": 12,
    "subastasGanadas": 3,
    "totalPujas": 47,
    "totalPujado": 250000.00,
    "totalPagado": 180000.00,
    "totalComisiones": 18000.00,
    "porCategoria": [
      { "categoria": "comun", "cantidad": 5 },
      { "categoria": "oro", "cantidad": 7 }
    ],
    "multas": { "total": 1, "impagas": 0 }
  }
}
```

---

### Notificaciones (`/api/notificaciones`)

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 23 | GET | `/notificaciones` | Si | Listar notificaciones |
| 24 | GET | `/notificaciones/count` | Si | Cantidad de no leidas |
| 25 | PUT | `/notificaciones/:id/leer` | Si | Marcar como leida |

---

### Health Check

| # | Metodo | Ruta | Auth | Descripcion |
|---|--------|------|------|-------------|
| 26 | GET | `/health` | No | Estado del servidor y conexion DB |

---

## Codigos HTTP

| Codigo | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validacion fallida) |
| 401 | Unauthorized (token invalido o ausente) |
| 403 | Forbidden (categoria insuficiente o bloqueado) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
