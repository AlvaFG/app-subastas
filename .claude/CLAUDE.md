# Sistema de Subastas — Project Config

## Project Overview
TPO academico DA1: App movil de subastas con React Native (Expo) + Node.js/Express + SQL Server.

## Key Files
- `TPO.md` — Requerimientos del negocio
- `EstructuraActual.sql` — Schema SQL Server (16 tablas existentes)
- `milestone.md` — Roadmap con 63 tasks en 7 fases

## Conventions
- **Language:** TypeScript everywhere (frontend + backend)
- **Naming (DB):** camelCase (respetar schema existente)
- **Naming (Code):** camelCase para variables/funciones, PascalCase para componentes/clases
- **API Response Format:** `{ success: boolean, data: any, error?: string }`
- **Branching:** feature/T{ID}-short-description (e.g., feature/T201-registro-etapa1)
- **Commits:** tipo(scope): descripcion — e.g., feat(auth): add JWT login endpoint

## Project Structure (Target)
```
/app                    # React Native (Expo) frontend
  /src
    /components         # Reusable UI components (design system)
    /screens            # Screen components
    /hooks              # Custom hooks
    /services           # API calls, socket client
    /store              # Zustand stores
    /theme              # Design tokens, colors, typography
    /utils              # Helpers
  app/                  # expo-router pages

/server                 # Node.js + Express backend
  /src
    /routes             # Express route definitions
    /controllers        # Request handlers
    /models             # DB queries and data access
    /middleware          # Auth, validation, error handling
    /services           # Business logic
    /socket             # Socket.IO event handlers
    /migrations         # SQL migration scripts
  .env                  # DB credentials, JWT secret, Cloudinary keys
```

## Custom Agents

### db-architect
- **Role:** Database design, migrations, query optimization
- **Context:** Read `EstructuraActual.sql` and `milestone.md` DB Design Notes
- **Rules:** Generate reversible migrations (UP/DOWN). Respect existing camelCase naming. Never DROP without confirmation.

### api-developer
- **Role:** REST endpoints and business logic
- **Context:** Read `TPO.md` for requirements, check milestone.md for current phase
- **Rules:** Use express-validator. Standard JSON responses. One controller per resource.

### mobile-ui
- **Role:** React Native screens and components
- **Context:** Design system from Fase 1, expo-router layout
- **Rules:** Use theme tokens. No hardcoded colors/sizes. Functional components only.

### test-runner
- **Role:** Testing (unit, integration, E2E)
- **Context:** Jest config, existing tests
- **Rules:** Min 70% coverage. Test happy path + edge cases. Mock external services.

### senior-architect
- **Role:** Code review, architecture decisions
- **Context:** Full project
- **Rules:** Prioritize simplicity. Reject over-engineering. Validate against TPO requirements.

## SQL Server Setup (2026-03-31)

### Location & Access
- **Running in:** Docker container (`sqlserver-subastas`)
- **Host:** `localhost:1433`
- **User:** `sa`
- **Password:** `TuContraseña123`
- **Database:** `subastas` (created via `server/create-db.js`)

### Start SQL Server
```bash
# SQL Server is running in Docker
docker start sqlserver-subastas

# Or if stopped:
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=TuContraseña123" \
  -p 1433:1433 --name sqlserver-subastas -d mcr.microsoft.com/mssql/server:latest
```

### Run Migrations
```bash
cd server
node run-migrations-v2.js
```

### Migration Scripts
- `001_fix_typos.sql` — Corrige constraints con typos (incativo→inactivo, carrada→cerrada)
- `002_nuevas_columnas.sql` — Agrega columnas: subastas.moneda, clientes.email, clientes.claveHash
- `003_nuevas_tablas.sql` — Crea 7 tablas: mediosDePago, sesiones, notificaciones, multas, solicitudesVenta, depositos, cuentasAVista

### Schema Notes
- Existing schema has 16 tables — do NOT modify existing columns without documenting in milestone.md
- All new tables use camelCase naming to match existing schema
- Migrations are idempotent (safe to re-run)
