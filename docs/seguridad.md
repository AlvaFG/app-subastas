# Seguridad

## Autenticacion

### JWT (JSON Web Tokens)

- **Access token:** expira en 1 hora
- **Refresh token:** expira en 7 dias, almacenado en tabla `sesiones`
- **Almacenamiento client-side:** `expo-secure-store` (keychain en iOS, keystore en Android)
- **Rotacion:** al usar refresh token, se invalida el anterior y se genera uno nuevo
- **Secretos:** `JWT_SECRET` y `JWT_REFRESH_SECRET` separados en variables de entorno

### bcrypt

- Salt rounds: 10
- Hasheo de claves en registro etapa 2
- Comparacion segura en login

---

## Autorizacion

### authGuard

Middleware que verifica el JWT Bearer token en el header `Authorization`. Extrae el payload y lo adjunta a `req.user`. Retorna 401 si el token es invalido o ausente.

### categoryGuard(minCategory)

Verifica que la categoria del usuario sea suficiente para acceder a un recurso. Jerarquia:

```
comun < especial < plata < oro < platino
```

Un usuario 'plata' puede acceder a recursos de categoria 'comun', 'especial' y 'plata'. Retorna 403 si la categoria es insuficiente.

### optionalAuth

Extrae usuario si hay token presente, pero no bloquea la request si no lo hay. Usado para mostrar contenido publico con datos extra para usuarios autenticados (ej: precios en catalogo).

### Socket Admin Auth

Los eventos `close-item` y `set-active-item` verifican que el usuario sea el subastador asignado a la subasta. Si no lo es, el callback retorna error.

---

## Validacion de Entrada

### express-validator

Todos los endpoints POST y PUT usan express-validator para validar:
- Campos requeridos presentes
- Tipos correctos (string, number, email)
- Valores dentro de rangos permitidos (ej: `acepta` solo 'si' o 'no')
- Sanitizacion de inputs

El middleware `validate` consolida los errores y retorna 400 con detalle.

### Validacion de pujas

- Importe no puede ser NaN ni negativo
- Debe superar la mejor oferta actual
- Debe respetar limites min (1% base) y max (20% base) — excepto oro/platino
- Se verifica saldo disponible de cheque certificado

---

## Proteccion contra Ataques

### SQL Injection

Todos los queries usan **parameterized queries** via mssql:

```typescript
const result = await pool.request()
  .input('email', sql.VarChar, email)
  .query('SELECT * FROM clientes WHERE email = @email');
```

Nunca se concatenan strings en queries SQL.

### Rate Limiting

- **express-rate-limit** en rutas `/api/auth`
- Limite: 15 requests por 15 minutos por IP
- Deshabilitado en entorno `test` para no interferir con tests
- Retorna 429 (Too Many Requests) al exceder

### CORS

- **cors** middleware con lista de origenes permitidos
- Configurado via variable `CORS_ORIGINS` (default: localhost:8081, localhost:19006)
- Rechaza requests de origenes no autorizados

### Security Headers

- **helmet** aplica headers de seguridad:
  - `X-Frame-Options`: previene clickjacking
  - `X-Content-Type-Options`: previene MIME sniffing
  - `Strict-Transport-Security`: fuerza HTTPS
  - Content Security Policy basico

---

## Protecciones de Negocio

### Cheque Certificado

- `montoDisponible` se verifica antes de aceptar puja (si es unico medio de pago)
- Se descuenta al cerrar item exitosamente
- Previene que el usuario gaste mas de lo garantizado

### Multas y Bloqueo

- Al crear multa, se marca `derivadaJusticia='no'`
- En login, se verifica si hay multas con `derivadaJusticia='si'`
- Si existe, se retorna 403 y el usuario no puede acceder a ningun servicio

### Soft Delete

- Medios de pago se "eliminan" con `activo='no'` en lugar de DELETE fisico
- Preserva integridad referencial y trazabilidad

### Restriccion 1 Subasta

- Map en memoria `userConnections` previene que un usuario se una a multiples subastas simultaneamente
- Se limpia automaticamente en disconnect
