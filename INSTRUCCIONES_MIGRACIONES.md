# Instrucciones: Ejecutar Migraciones SQL

## ⚠️ Requisito Previo

**SQL Server debe estar corriendo** en `localhost:1433` con:
- Usuario: `sa`
- Contraseña: `TuContraseña123`
- Base de datos: `subastas`

## Opción 1: Ejecutar desde Node.js (Recomendado)

```bash
cd c:\DA1\proyecto\server
node run-migrations.js
```

`run-migrations.js` lee las credenciales de `.env` (no hardcodeadas), aplica primero el
baseline idempotente `unified-migrations.sql` y luego, en orden, cada
`server/migrations/NNN_*.sql`. Lleva control de versiones en la tabla `schema_version`
(cada migración se aplica una sola vez) y es totalmente **idempotente** (re-ejecutar es seguro).

**Rollback** de una migración incremental (corre la sección `-- @DOWN` del archivo):

```bash
node run-migrations.js down 005_pujos_fecha.sql
```

> El baseline `run-unified-migrations.js` queda como utilitario legacy (solo aplica el schema base, sin control de versiones). Preferí `run-migrations.js`.

## Opción 2: Ejecutar manualmente en SQL Server Management Studio

1. Abre **SQL Server Management Studio**
2. Conecta a `localhost` con usuario `sa` y contraseña `TuContraseña123`
3. Selecciona la base de datos `subastas`
4. Abre y ejecuta `server/unified-migrations.sql`

## Opción 3: Ejecutar desde PowerShell

Si tienes instalado `sqlcmd`:

```powershell
cd c:\DA1\proyecto
sqlcmd -S localhost -U sa -P "TuContraseña123" -d subastas -i "server/unified-migrations.sql"
```

### Migración adicional

Si ya tenés el schema base y solo necesitás agregar la columna moneda a multas:

```powershell
sqlcmd -S localhost -U sa -P "TuContraseña123" -d subastas -i "server/migrations/004_add_moneda_to_multas.sql"
```

## Tablas que se Crearán

Si todo funciona correctamente, se crearán estas tablas nuevas:
- ✅ `mediosDePago` — Métodos de pago de clientes
- ✅ `sesiones` — Sesiones JWT activas
- ✅ `notificaciones` — Notificaciones privadas
- ✅ `multas` — Multas por impago (10%)
- ✅ `solicitudesVenta` — Solicitudes de venta de items
- ✅ `depositos` — Ubicación física de piezas
- ✅ `cuentasAVista` — Cuentas para pagos a dueños

Y se modificarán estas columnas:
- ✅ `subastas.moneda` — Nueva columna
- ✅ `clientes.email` — Nueva columna
- ✅ `clientes.claveHash` — Nueva columna
- ✅ `productos.deposito` — Nueva columna

### Migraciones incrementales (carpeta `server/migrations/`)

Se aplican automáticamente con `node run-migrations.js`:
- `004_add_moneda_to_multas.sql` — `multas.moneda` (multimoneda en multas)
- `005_pujos_fecha.sql` — `pujos.fechaPuja` (orden temporal de pujas) — **requerida para pujar y cerrar ítems**
- `006_indices.sql` — índices/unicidad (`clientes.email`, `pujos.item`, `mediosDePago.cliente`, `asistentes`)
- `007_documentos_cliente.sql` — tabla `documentosCliente` (fotos de documento del registro)
- `008_venta_schema.sql` — tablas de solicitud/artículos de venta (antes creadas en runtime)
- `009_fk_integrity.sql` — FK `productos.seguro` → `seguros`
- `010_login_security.sql` — `clientes.failedAttempts` / `lockUntil` (anti fuerza-bruta)

> El backend espera el schema migrado. En particular, **place-bid y el cierre de ítems requieren la migración 005** (`pujos.fechaPuja`). Ejecutá `node run-migrations.js` antes de levantar el server.

## Scripts Auxiliares

```bash
cd c:\DA1\proyecto\server

# Listar usuarios registrados
node scripts/list-users.js

# Resetear contraseña de un usuario
node scripts/reset-user-password.js
```

## Verificación

Después de ejecutar las migraciones, verifica que todo funcionó:

```bash
cd c:\DA1\proyecto\server
npm run dev
```

Debería iniciar sin errores de base de datos.

---

**Nota:** Las migraciones son idempotentes por diseño (guardas `IF OBJECT_ID/COL_LENGTH/INDEXPROPERTY ... IS NULL`) y se registran en `schema_version`, por lo que `run-migrations.js` se puede re-ejecutar sin efectos colaterales (cada migración corre una sola vez y, aun forzada, es segura).
