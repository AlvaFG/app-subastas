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

**Salida esperada:**
```
✅ Conectado a SQL Server

📝 Ejecutando: 001_fix_typos.sql
✅ 001_fix_typos.sql completada

📝 Ejecutando: 002_nuevas_columnas.sql
✅ 002_nuevas_columnas.sql completada

📝 Ejecutando: 003_nuevas_tablas.sql
✅ 003_nuevas_tablas.sql completada

✅ Migraciones completadas!
```

## Opción 2: Ejecutar manualmente en SQL Server Management Studio

1. Abre **SQL Server Management Studio**
2. Conecta a `localhost` con usuario `sa` y contraseña `TuContraseña123`
3. Selecciona la base de datos `subastas`
4. Abre y ejecuta cada archivo en este orden:
   - `server/src/migrations/001_fix_typos.sql`
   - `server/src/migrations/002_nuevas_columnas.sql`
   - `server/src/migrations/003_nuevas_tablas.sql`

## Opción 3: Ejecutar desde PowerShell

Si tienes instalado `sqlcmd`:

```powershell
cd c:\DA1\proyecto

# Migration 1
sqlcmd -S localhost -U sa -P "TuContraseña123" -d subastas -i "server/src/migrations/001_fix_typos.sql"

# Migration 2
sqlcmd -S localhost -U sa -P "TuContraseña123" -d subastas -i "server/src/migrations/002_nuevas_columnas.sql"

# Migration 3
sqlcmd -S localhost -U sa -P "TuContraseña123" -d subastas -i "server/src/migrations/003_nuevas_tablas.sql"
```

## Tablas que se Crearán

Si todo funciona correctamente, se crearán estas 7 tablas nuevas:
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

## Verificación

Después de ejecutar las migraciones, verifica que todo funcionó:

```bash
cd c:\DA1\proyecto\server
npm run dev
```

Debería iniciar sin errores de base de datos.

---

**Nota:** Las migraciones son idempotentes. Si una tabla ya existe, se ignorará el error y continuará.
