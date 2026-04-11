# Modelos y Servicios (Frontend)

## authStore (Zustand)

Archivo: `app/src/store/authStore.ts`

### Estado

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `user` | `User \| null` | Usuario autenticado |
| `isAuthenticated` | boolean | Si hay sesion activa |
| `isLoading` | boolean | Carga en progreso |

### Interfaz User

```typescript
interface User {
  id: number
  nombre: string
  email: string
  categoria: string  // 'comun' | 'especial' | 'plata' | 'oro' | 'platino'
}
```

### Acciones

| Accion | Parametros | Descripcion |
|--------|-----------|-------------|
| `login` | `(email, clave)` | POST /auth/login. Guarda tokens en SecureStore, setea user. |
| `registerStep1` | `(RegisterStep1Data)` | POST /auth/register/step1. Retorna identificador. |
| `registerStep2` | `(RegisterStep2Data)` | POST /auth/register/step2. Completa registro. |
| `loadUser` | `()` | GET /auth/me. Restaura sesion si hay token almacenado. |
| `logout` | `()` | Limpia tokens de SecureStore, resetea estado. |

### Tipos de Registro

```typescript
interface RegisterStep1Data {
  documento: string
  nombre: string
  direccion: string
  numeroPais: number
}

interface RegisterStep2Data {
  identificador: number
  email: string
  clave: string
}
```

---

## api.ts (Axios)

Archivo: `app/src/services/api.ts`

### Configuracion

```typescript
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'
});
```

### Interceptores

**Request:** Agrega `Authorization: Bearer {token}` a cada request (lee token de SecureStore).

**Response:**
- Si respuesta 401 -> intenta refresh via POST /auth/refresh
- Si refresh exitoso -> reintenta request original con nuevo token
- Si refresh falla -> limpia tokens (fuerza logout)

### Formato esperado

Todas las respuestas del backend siguen:
```typescript
{ success: boolean, data: any, error?: string }
```

---

## socket.ts (Socket.IO Client)

Archivo: `app/src/services/socket.ts`

### Funciones

| Funcion | Retorno | Descripcion |
|---------|---------|-------------|
| `connectSocket()` | `Promise<Socket>` | Conecta con JWT del SecureStore, resuelve en evento 'connect' |
| `getSocket()` | `Socket \| null` | Retorna instancia actual |
| `disconnectSocket()` | `void` | Desconecta y nullea referencia |

### Configuracion

```typescript
const socket = io(URL, {
  transports: ['websocket'],
  auth: { token }  // JWT de SecureStore
});
```

### Eventos Principales

| Evento | Direccion | Datos |
|--------|-----------|-------|
| `join-auction` | emit | `{ subastaId }` + callback |
| `leave-auction` | emit | `{ subastaId }` |
| `place-bid` | emit | `{ subastaId, itemId, importe }` + callback |
| `new-bid` | on | `{ bidId, itemId, importe, postorNombre, timestamp }` |
| `active-item-changed` | on | `{ itemId, precioBase, descripcionCatalogo }` |
| `item-sold` | on | `{ itemId, ganadorNombre, importe, comision }` |
| `item-no-bids` | on | `{ itemId, precioBase }` |
| `you-won` | on | `{ itemId, importe, comision, costoEnvio, moneda }` |

---

## Tipos Principales

### Subasta

```typescript
interface Subasta {
  identificador: number
  fecha: string
  hora: string
  estado: string        // 'abierta' | 'cerrada'
  ubicacion: string
  categoria: string
  moneda: string        // 'ARS' | 'USD'
  totalItems: number
  subastadorNombre: string
}
```

### CatalogoItem

```typescript
interface CatalogoItem {
  identificador: number
  precioBase?: number       // solo con auth
  comision?: number         // solo con auth
  subastado: string         // 'si' | 'no'
  descripcionCatalogo: string
  descripcionCompleta: string
  duenioNombre: string
  catalogoDescripcion: string
  fotoId: number | null
}
```

### Notificacion

```typescript
interface Notificacion {
  identificador: number
  tipo: string          // 'ganador' | 'multa' | 'inspeccion' | 'pago' | 'sistema'
  titulo: string
  mensaje: string
  leida: string         // 'si' | 'no'
  fecha: string
}
```

### Estadisticas

```typescript
interface Estadisticas {
  subastasAsistidas: number
  subastasGanadas: number
  totalPujas: number
  totalPujado: number
  totalPagado: number
  totalComisiones: number
  porCategoria: { categoria: string; cantidad: number }[]
  multas: { total: number; impagas: number }
}
```
