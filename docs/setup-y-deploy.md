# Setup y Deploy

## Requisitos

| Software | Version | Notas |
|----------|---------|-------|
| Node.js | 18+ | Recomendado: LTS |
| SQL Server | 2019+ | Express edition funciona |
| Expo CLI | Latest | `npm install -g expo-cli` |
| Git | 2.x | Control de versiones |

---

## Backend (server/)

### 1. Instalar dependencias

```bash
cd server
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

```env
PORT=3000
DB_USER=sa
DB_PASSWORD=tu_password
DB_SERVER=localhost
DB_NAME=subastas
DB_PORT=1433
JWT_SECRET=un_secreto_seguro_largo
JWT_REFRESH_SECRET=otro_secreto_diferente
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

### Variables de entorno

| Variable | Descripcion | Requerida |
|----------|-------------|-----------|
| `PORT` | Puerto del servidor (default: 3000) | No |
| `DB_USER` | Usuario SQL Server | Si |
| `DB_PASSWORD` | Password SQL Server | Si |
| `DB_SERVER` | Host SQL Server | Si |
| `DB_NAME` | Nombre de la base de datos | Si |
| `DB_PORT` | Puerto SQL Server (default: 1433) | No |
| `JWT_SECRET` | Secreto para firmar access tokens | Si |
| `JWT_REFRESH_SECRET` | Secreto para firmar refresh tokens | Si |
| `CLOUDINARY_CLOUD_NAME` | Nombre del cloud en Cloudinary | Si |
| `CLOUDINARY_API_KEY` | API key de Cloudinary | Si |
| `CLOUDINARY_API_SECRET` | API secret de Cloudinary | Si |
| `CORS_ORIGINS` | Origenes permitidos (comma-separated) | No |
| `NODE_ENV` | Entorno: development/test/production | No |

### 3. Crear la base de datos

En SQL Server Management Studio o sqlcmd:

```sql
CREATE DATABASE subastas;
```

### 4. Ejecutar schema original

Ejecutar `EstructuraActual.sql` en la base de datos `subastas`.

### 5. Ejecutar migraciones

Ejecutar en orden:

```
server/src/migrations/001_fix_typos.sql
server/src/migrations/002_nuevas_columnas.sql
server/src/migrations/003_nuevas_tablas.sql
```

### 6. Iniciar servidor

```bash
npm run dev          # Desarrollo (nodemon, hot reload)
npm run build        # Compilar TypeScript
npm start            # Produccion (desde dist/)
```

El servidor inicia en `http://localhost:3000`.

Verificar con: `GET http://localhost:3000/api/health`

---

## Frontend (app/)

### 1. Instalar dependencias

```bash
cd app
npm install
```

### 2. Configurar API URL

Crear archivo `.env` en `app/`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

Para dispositivo fisico, usar la IP local de la maquina (ej: `http://192.168.1.100:3000/api`).

### 3. Iniciar Expo

```bash
npx expo start
```

Opciones:
- `i` — Abrir en iOS Simulator
- `a` — Abrir en Android Emulator
- Escanear QR con Expo Go (dispositivo fisico)

---

## Scripts Disponibles

### Backend (server/)

| Script | Comando | Descripcion |
|--------|---------|-------------|
| `dev` | `nodemon` | Desarrollo con hot reload |
| `build` | `tsc` | Compilar TypeScript a JavaScript |
| `start` | `node dist/index.js` | Ejecutar compilado |
| `test` | `jest --forceExit` | Ejecutar 93 tests |

### Frontend (app/)

| Script | Comando | Descripcion |
|--------|---------|-------------|
| `start` | `expo start` | Iniciar dev server Expo |
| `android` | `expo start --android` | Abrir en Android |
| `ios` | `expo start --ios` | Abrir en iOS |

---

## Troubleshooting

### Error de conexion a SQL Server

- Verificar que SQL Server este corriendo y acepte conexiones TCP/IP
- Verificar puerto 1433 habilitado en SQL Server Configuration Manager
- Si usa Windows Auth, cambiar `DB_USER` y `DB_PASSWORD` apropiadamente

### CORS errors en frontend

- Verificar que `EXPO_PUBLIC_API_URL` apunte al backend correcto
- Si corre en dispositivo fisico, usar IP local (no `localhost`)
- Verificar `CORS_ORIGINS` en `.env` del server incluya el origen del frontend

### Socket.IO no conecta

- Verificar que el backend este corriendo
- La URL de Socket.IO es la base del servidor (sin `/api`)
- Verificar que el token JWT sea valido

### Expo Go: "Network request failed"

- En Android emulator, `localhost` no funciona — usar `10.0.2.2` (o IP local)
- En iOS simulator, `localhost` funciona normalmente
- Verificar firewall no bloquee el puerto

### Tests fallan por conexion DB

- Los tests mockean la DB, no deberian necesitar conexion real
- Si fallan, verificar que los mocks esten correctamente configurados
- `NODE_ENV=test` deshabilita rate limiting para no interferir
