# Sistema de Subastas

App movil de subastas en tiempo real desarrollada como TPO para la materia Desarrollo de Aplicaciones 1 (DA1).

## Integrantes

| Nombre | Legajo |
|--------|--------|
| _Completar_ | _Completar_ |
| _Completar_ | _Completar_ |
| _Completar_ | _Completar_ |

## Stack Tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Frontend | React Native (Expo) | 0.83.2 (Expo 55) |
| Navegacion | expo-router | 55.0.4 |
| Estado global | Zustand | 5.0.11 |
| Backend | Node.js + Express | Express 5.2.1 |
| Tiempo real | Socket.IO | 4.8.3 |
| Base de datos | SQL Server | 2019+ |
| Driver DB | mssql (tedious) | 12.2.0 |
| Auth | JWT + bcrypt | jsonwebtoken 9, bcrypt 6 |
| Imagenes | Cloudinary | 2.9.0 |
| Testing | Jest + Supertest | Jest 30, Supertest 7 |

## Estructura del Proyecto

```
proyecto/
  app/                          # React Native (Expo) frontend
    app/                        # expo-router pages
      (auth)/                   # Stack autenticacion
        login.tsx
        register/step1.tsx
        register/step2.tsx
      (tabs)/                   # Bottom tab navigator
        index.tsx               # Subastas (home)
        catalogo.tsx            # Catalogo
        vender.tsx              # Venta de items
        perfil.tsx              # Perfil usuario
      subasta/[id].tsx          # Catalogo de subasta
      subasta/[id]/live.tsx     # Subasta en vivo
      item/[id].tsx             # Detalle de pieza
      estadisticas.tsx          # Dashboard metricas
      notificaciones.tsx        # Notificaciones
    src/
      components/               # Button, Input, Card, Modal, Badge, Avatar, Loading
      theme/                    # Design tokens (colors, typography, spacing, motion)
      store/                    # Zustand stores (authStore)
      services/                 # api.ts (Axios), socket.ts (Socket.IO)

  server/                       # Node.js + Express backend
    src/
      routes/                   # 7 archivos de rutas (22 endpoints)
      controllers/              # 7 controllers
      middleware/               # authGuard, categoryGuard, validate
      models/                   # db.ts (mssql connection pool)
      socket/                   # auctionHandler.ts (subastas en vivo)
      migrations/               # 3 scripts SQL
      __tests__/                # 93 tests (unit + E2E)
      swagger.ts                # OpenAPI 3.0.3 spec
      index.ts                  # Entry point

  docs/                         # Documentacion completa
  EstructuraActual.sql          # Schema SQL Server original (16 tablas)
  TPO.md                        # Requerimientos del negocio
  milestone.md                  # Roadmap (63 tasks, 7 fases)
```

## Quick Start

### Requisitos

- Node.js 18+
- SQL Server 2019+
- Expo CLI (`npm install -g expo-cli`)

### Backend

```bash
cd server
npm install
cp .env.example .env          # Configurar credenciales DB, JWT secrets, Cloudinary
# Ejecutar migraciones en orden:
#   src/migrations/001_fix_typos.sql
#   src/migrations/002_nuevas_columnas.sql
#   src/migrations/003_nuevas_tablas.sql
npm run dev
```

### Frontend

```bash
cd app
npm install
# Configurar EXPO_PUBLIC_API_URL en .env (default: http://localhost:3000/api)
npx expo start
```

### Tests

```bash
cd server
npm test                      # 93 tests, 7 suites
```

## Documentacion

| Documento | Descripcion |
|-----------|-------------|
| [Arquitectura](docs/arquitectura.md) | Diagrama de arquitectura, patron MVC, middleware, Socket.IO |
| [API REST](docs/api-rest.md) | 22 endpoints documentados con parametros y respuestas |
| [Socket.IO](docs/socket-io.md) | Protocolo de subastas en tiempo real |
| [Base de Datos](docs/base-de-datos.md) | 23 tablas, diagrama ER, migraciones |
| [Design System](docs/design-system.md) | Paleta de colores, tipografia, spacing, sombras, motion |
| [Componentes UI](docs/componentes-ui.md) | 7 componentes reutilizables con props y variantes |
| [Pantallas](docs/pantallas.md) | 17 rutas, flujos de navegacion |
| [Modelos y Servicios](docs/modelos-y-servicios.md) | Zustand store, Axios, Socket.IO client |
| [Backend Controllers](docs/backend-controllers.md) | 7 controllers, logica de negocio |
| [Seguridad](docs/seguridad.md) | JWT, bcrypt, rate limiting, CORS, validacion |
| [Testing](docs/testing.md) | 93 tests, estrategia de testing, mocking |
| [Setup y Deploy](docs/setup-y-deploy.md) | Guia de instalacion paso a paso |
| [Dependencias](docs/dependencias.md) | Librerias frontend y backend con versiones |

## Requerimientos Implementados

El proyecto cubre los 27 requerimientos del TPO. Ver [milestone.md](milestone.md) para el checklist completo de verificacion y el detalle de las 63 tasks implementadas en 7 fases.
