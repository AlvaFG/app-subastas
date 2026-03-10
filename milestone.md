# Sistema de Subastas — Milestone & Roadmap

## Tech Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | React Native + Expo (expo-router) |
| Backend | Node.js + Express + Socket.IO |
| Base de Datos | SQL Server (schema existente + extensiones) |
| Driver DB | mssql (tedious) |
| Auth | JWT + bcrypt |
| Tiempo Real | Socket.IO |
| Imagenes | expo-image-picker + Cloudinary |

---

## Skills & Plugins

### Community Skills (`.agents/skills/`)

| Skill | Fuente | Comando | Uso en Proyecto | Estado |
|-------|--------|---------|-----------------|--------|
| find-skills | vercel-labs/skills | `npx skills add vercel-labs/skills@find-skills` | Descubrir mas skills del registro | instalada |
| building-native-ui | expo/skills (16K installs) | `npx skills add expo/skills@building-native-ui` | Componentes nativos, animaciones, tabs, icons, forms, gradients | instalada |
| native-data-fetching | expo/skills (10K installs) | `npx skills add expo/skills@native-data-fetching` | Data fetching, expo-router loaders, caching | instalada |
| react-native-testing | callstack (242 installs) | `npx skills add callstack/react-native-testing-library@react-native-testing` | Testing componentes RN, anti-patterns, API ref v13/v14 | instalada |
| upgrade-react-native | react-native-community (172 installs) | `npx skills add react-native-community/skills@upgrade-react-native` | Upgrade helper, migraciones de version | instalada |
| auth-implementation-patterns | wshobson/agents (3.6K installs) | `npx skills add wshobson/agents@auth-implementation-patterns` | Patrones JWT, registro, auth guards — Fase 2 | instalada |
| api-security-best-practices | sickn33 (2.2K installs) | `npx skills add sickn33/antigravity-awesome-skills@api-security-best-practices` | Seguridad API, OWASP, helmet, CORS — backend | instalada |
| websocket-engineer | jeffallan (1.2K installs) | `npx skills add jeffallan/claude-skills@websocket-engineer` | WebSocket/Socket.IO patterns — Fase 4 subastas live | instalada |

### Bundled Skills (Claude Code)

| Skill | Activacion | Uso en Proyecto |
|-------|-----------|-----------------|
| simplify | `/simplify` | Review de codigo: reuso, calidad, eficiencia |
| claude-api | auto (imports anthropic) | Integracion con Claude API si se necesita |

### Plugins (Claude Code `/plugin`)

| Plugin | Skills incluidas | Uso en Proyecto |
|--------|-----------------|-----------------|
| **frontend-design** | frontend-design | Design system, estetica, componentes UI con alta calidad visual |
| **superpowers** | brainstorming, writing-plans, executing-plans, dispatching-parallel-agents, subagent-driven-development, requesting-code-review, receiving-code-review, verification-before-completion, finishing-a-development-branch, writing-skills, using-git-worktrees, systematic-debugging, test-driven-development, using-superpowers | Workflow completo: planificacion, ejecucion paralela, TDD, debugging, code review, git worktrees |
| **code-review** | code-review | Review de pull requests |
| **feature-dev** | feature-dev | Desarrollo guiado de features con analisis de codebase |
| **claude-md-management** | revise-claude-md, claude-md-improver | Mantenimiento y auditoria de CLAUDE.md |

---

## Custom Agents

### db-architect
- **Role:** Diseno y migraciones de base de datos
- **Context:** `EstructuraActual.sql`, milestone.md (DB Design Notes)
- **Rules:** Nunca DROP sin confirmacion. Siempre generar scripts reversibles (UP/DOWN). Respetar naming conventions del schema existente (camelCase).

### api-developer
- **Role:** Endpoints REST y logica de negocio backend
- **Context:** `TPO.md`, rutas Express, modelos
- **Rules:** Validar inputs con express-validator. Respuestas JSON estandarizadas `{ success, data, error }`. Documentar cada endpoint.

### mobile-ui
- **Role:** Pantallas y componentes React Native
- **Context:** Design system (Fase 1), expo-router layout
- **Rules:** Usar design tokens del theme. No hardcodear colores/sizes. Componentes funcionales con TypeScript.

### test-runner
- **Role:** Testing unitario, integracion y E2E
- **Context:** Jest config, test utilities
- **Rules:** Coverage minimo 70%. Testear happy path + edge cases. Mocks para DB y servicios externos.

### senior-architect
- **Role:** Code review, decisiones de arquitectura, resolucion de conflictos entre agentes
- **Context:** Todo el proyecto
- **Rules:** Evaluar trade-offs antes de aprobar. Priorizar simplicidad. Vetar over-engineering.

---

## React Native Libraries

| Paquete | Uso |
|---------|-----|
| expo | Framework base |
| expo-router | Navegacion file-based |
| expo-image-picker | Seleccion de fotos (min 6 para items) |
| expo-secure-store | Almacenamiento seguro de JWT |
| @react-navigation/native | Navegacion subyacente |
| react-native-reanimated | Animaciones fluidas |
| react-native-gesture-handler | Gestos tactiles |
| react-native-safe-area-context | Safe areas |
| socket.io-client | Conexion tiempo real con backend |
| react-native-vector-icons | Iconografia |
| axios | HTTP client |
| react-hook-form | Formularios con validacion |
| zustand | Estado global ligero |
| @expo-google-fonts/playfair-display | Display font — precios, titulos subasta |
| @expo-google-fonts/dm-sans | Heading + body font |
| expo-font | Carga de fuentes custom |
| react-native-svg | Iconos custom, graficos estadisticas |
| moti | Animaciones declarativas sobre reanimated |

## Backend Libraries

| Paquete | Uso |
|---------|-----|
| express | Framework HTTP |
| socket.io | WebSocket server para pujas en tiempo real |
| mssql | Driver SQL Server (tedious) |
| jsonwebtoken | Generacion/verificacion JWT |
| bcrypt | Hash de passwords |
| express-validator | Validacion de inputs |
| cors | Cross-origin requests |
| helmet | Headers de seguridad |
| morgan | Logging HTTP |
| multer | Upload de archivos |
| cloudinary | SDK para almacenamiento de imagenes |
| dotenv | Variables de entorno |
| nodemon | Dev server con hot reload |

---

## DB Design Notes

### Tablas nuevas a crear

| Tabla | Proposito |
|-------|----------|
| mediosDePago | Cuentas bancarias, tarjetas, cheques certificados |
| sesiones | Tokens JWT activos / refresh tokens |
| notificaciones | Mensajes privados al ganador, multas, etc. |
| multas | Registro de multas del 10% por impago |
| solicitudesVenta | Items que usuarios quieren subastar |
| depositos | Ubicacion fisica de piezas entregadas |
| cuentasAVista | Cuentas destino para pagos a duenos |

### Correcciones de typos en EstructuraActual.sql

| Linea | Actual | Corregido |
|-------|--------|-----------|
| 16 | `'incativo'` | `'inactivo'` |
| 88 | `'carrada'` | `'cerrada'` |
| 40 | `nroPoliza varchar(30) not null.` (punto) | `nroPoliza varchar(30) not null,` (coma) |

### Columnas a agregar

| Tabla | Columna | Tipo | Motivo |
|-------|---------|------|--------|
| subastas | moneda | varchar(3) | Soporte pesos/dolares (TPO req.) |
| clientes | email | varchar(250) | Envio de mail etapa 2 registro |
| clientes | claveHash | varchar(250) | Password hasheada del usuario |

---

## Design System Spec (frontend-design)

### Aesthetic Direction

**Tone:** Luxury Refined — Una casa de subastas es sinonimo de exclusividad. La app debe transmitir confianza, sofisticacion y urgencia controlada. Inspiracion en catalagos de Christie's y Sotheby's cruzados con fintech moderna.

**Differentiation:** La pantalla de subasta en vivo es el momento memorable — un fondo oscuro dramatico con tipografia serif grande para el precio actual, animaciones de pulso cuando llegan nuevas pujas, y un degradado dorado sutil que intensifica a medida que sube el precio.

### Color Palette

```
/* CSS Variables — theme/colors.ts */

/* Primarios */
--ink:          #0B0E11      /* Fondo principal dark mode */
--ivory:        #FAF8F5      /* Fondo principal light mode */
--parchment:    #F2EDE6      /* Superficies elevadas light */
--graphite:     #1A1D23      /* Superficies elevadas dark */

/* Acentos */
--auction-gold: #C9A84C      /* Accion principal, CTA, highlights */
--bid-green:    #2D936C      /* Puja exitosa, confirmaciones */
--alert-ember:  #D64545      /* Errores, multas, danger */
--steel-blue:   #4A7C9B      /* Links, info secundaria */

/* Categorias (badges) */
--cat-comun:    #8B8D91      /* Gris neutro */
--cat-especial: #5B7FA5      /* Azul acero */
--cat-plata:    #A8B5C2      /* Plata metalico */
--cat-oro:      #C9A84C      /* Dorado */
--cat-platino:  #E8E4DF      /* Blanco platino con borde sutil */

/* Neutros */
--text-primary:   #1A1D23
--text-secondary: #6B7280
--text-muted:     #9CA3AF
--border:         #E5E1DB
--border-dark:    #2A2D33
```

### Typography

```
/* theme/typography.ts */

Display Font:  "Playfair Display"   /* Serif — precios, titulos de subasta, numeros grandes */
Heading Font:  "DM Sans"            /* Sans — headings, navegacion, labels */
Body Font:     "DM Sans"            /* Sans — cuerpo de texto, descripciones */
Mono Font:     "JetBrains Mono"     /* Monospace — IDs de pieza, timestamps, importes */

/* Scale */
--text-xs:    12px / 1.4    /* Captions, timestamps */
--text-sm:    14px / 1.5    /* Labels, metadata */
--text-base:  16px / 1.6    /* Body text */
--text-lg:    18px / 1.5    /* Subtitles */
--text-xl:    22px / 1.3    /* Section headings */
--text-2xl:   28px / 1.2    /* Page titles */
--text-3xl:   36px / 1.1    /* Precio actual en subasta live */
--text-hero:  48px / 1.0    /* Splash, onboarding hero */

/* Weights */
--font-regular:  400
--font-medium:   500
--font-semibold: 600
--font-bold:     700
```

### Spacing & Radius

```
/* theme/spacing.ts */
--space-xs:   4px
--space-sm:   8px
--space-md:   16px
--space-lg:   24px
--space-xl:   32px
--space-2xl:  48px
--space-3xl:  64px

/* Border Radius */
--radius-sm:  6px     /* Badges, chips */
--radius-md:  12px    /* Cards, inputs */
--radius-lg:  16px    /* Modals, sheets */
--radius-xl:  24px    /* Botones pill */
--radius-full: 9999px /* Avatares */
```

### Shadows & Elevation

```
/* theme/shadows.ts */
--shadow-sm:  0 1px 2px rgba(11,14,17,0.06)                           /* Inputs focus */
--shadow-md:  0 4px 12px rgba(11,14,17,0.08)                          /* Cards */
--shadow-lg:  0 8px 24px rgba(11,14,17,0.12)                          /* Modals */
--shadow-glow: 0 0 20px rgba(201,168,76,0.25)                         /* Gold highlight pujas */
```

### Component Specs

#### Button (T102)
| Variante | Background | Text | Border | Uso |
|----------|-----------|------|--------|-----|
| primary | auction-gold | ink | none | CTA: "Pujar", "Registrarse" |
| secondary | parchment | text-primary | border | "Ver catalogo", "Filtrar" |
| outline | transparent | auction-gold | auction-gold | Acciones secundarias |
| ghost | transparent | text-secondary | none | "Cancelar", "Atras" |
| danger | alert-ember | ivory | none | "Eliminar medio de pago" |
- **Height:** 48px (md), 40px (sm), 56px (lg — puja button)
- **Radius:** radius-xl (pill shape)
- **Motion:** Scale 0.97 on press (120ms), haptic feedback en "Pujar"
- **Typography:** DM Sans semibold, text-base

#### Input (T103)
- **Height:** 52px
- **Radius:** radius-md
- **Border:** 1.5px border, border-dark en dark mode
- **Focus:** border auction-gold + shadow-sm gold
- **Error:** border alert-ember, texto error debajo en text-sm
- **Label:** DM Sans medium text-sm, text-secondary, posicion arriba
- **Password toggle:** Icono ojo en posicion derecha
- **Variants:** default, error, disabled, focused, with-icon

#### Card (T104)
- **Radius:** radius-md
- **Shadow:** shadow-md
- **Layout:** Imagen arriba (aspect-ratio 4:3), contenido abajo
- **Imagen:** Overflow hidden con radius-md top
- **Contenido:** padding space-md. Titulo (DM Sans semibold text-lg), precio (Playfair Display bold text-xl auction-gold), descripcion truncada (text-sm text-secondary)
- **Hover/Press:** Elevacion sube a shadow-lg, scale 1.02 (200ms ease-out)
- **Badge categoria:** Posicion absoluta top-right sobre la imagen

#### Modal (T105)
- **Overlay:** rgba(11,14,17,0.6) con backdrop-blur 8px
- **Container:** radius-lg, shadow-lg, max-width 90%
- **Entry:** Slide up 300ms + fade in (react-native-reanimated)
- **Exit:** Fade out 200ms
- **Bottom Sheet variant:** Radius solo top, drag handle 40x4px centered

#### Badge (T106)
- **Size:** Height 24px, padding horizontal space-sm
- **Radius:** radius-sm
- **Typography:** DM Sans medium text-xs uppercase letter-spacing 0.5px
- **Colores por categoria:**
  - comun: bg cat-comun/15, text cat-comun
  - especial: bg cat-especial/15, text cat-especial
  - plata: bg cat-plata/15, text cat-plata, borde 1px cat-plata
  - oro: bg cat-oro/10, text cat-oro, borde 1px cat-oro, shadow-glow sutil
  - platino: bg cat-platino/10, text ink, borde 1px cat-platino, shimmer animation

#### Avatar (T107)
- **Sizes:** 32px (sm), 40px (md), 56px (lg), 80px (xl — perfil)
- **Shape:** radius-full
- **Fallback:** Iniciales en DM Sans bold, bg auction-gold/20, text auction-gold
- **Border:** 2px ivory (sobre fondos oscuros)

#### Loading (T108)
- **Skeleton:** Animated shimmer gradient (parchment -> ivory -> parchment), 1.5s loop
- **Spinner:** Ring de 2px auction-gold, 24px, rotacion 800ms linear
- **Pull-to-refresh:** Icono martillo de subasta que gira

### Motion Guidelines

```
/* theme/motion.ts */

/* Durations */
--duration-fast:   120ms   /* Press feedback, toggles */
--duration-normal: 200ms   /* Hover states, small transitions */
--duration-slow:   300ms   /* Modals, page transitions */
--duration-crawl:  600ms   /* Skeleton shimmer, onboarding */

/* Easings */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1)     /* Entradas */
--ease-in:     cubic-bezier(0.55, 0.055, 0.675, 0.19)  /* Salidas */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)  /* Pujas nuevas */
```

**Momentos clave de animacion:**
1. **Nueva puja recibida:** Precio actual pulsa (scale 1.05 + shadow-glow) con ease-bounce, 400ms
2. **Puja enviada exitosamente:** Flash verde bid-green en el borde del input, check icon fade-in
3. **Cierre de subasta:** Overlay con "VENDIDO" en Playfair Display hero, fade-in dramatico 600ms
4. **Cambio de item:** Cross-fade entre items del catalogo, 300ms
5. **Badge categoria:** Platino tiene shimmer perpetuo sutil (gradiente lineal animado)

### Screen Layout Map

```
app/
  (auth)/
    login.tsx              — Login con fondo ink, logo centered
    register/
      step1.tsx            — Formulario datos personales (scroll)
      step2.tsx            — Crear clave tras aprobacion
  (tabs)/
    index.tsx              — Home: proximas subastas destacadas
    subastas.tsx           — Lista completa con filtros
    vender.tsx             — Solicitud de venta
    perfil.tsx             — Datos, categoria, medios de pago
  subasta/
    [id].tsx               — Catalogo de una subasta
    [id]/live.tsx          — Subasta en vivo (full screen, dark)
  item/
    [id].tsx               — Detalle de pieza
  notificaciones.tsx       — Lista de notificaciones
  estadisticas.tsx         — Dashboard metricas
```

---

## Fase 0 — Project Setup (T001-T008)

| ID | Feature | Tasks | Agents & Plugins | Description | Status | Priority | Complexity | Dependencies |
|----|---------|-------|-------------------|-------------|--------|----------|------------|--------------|
| T001 | Expo Init | Crear proyecto Expo con TypeScript | mobile-ui | `npx create-expo-app@latest app --template blank-typescript` | done | critical | low | — |
| T002 | Expo Router | Instalar y configurar expo-router | mobile-ui | File-based routing, layout raiz, 4 tabs + auth stack | done | critical | low | T001 |
| T003 | Express Init | Crear proyecto Express + TS | api-developer | Estructura carpetas: routes/, controllers/, models/, middleware/ | done | critical | low | — |
| T004 | Socket.IO Setup | Integrar Socket.IO en Express | api-developer | Servidor WS compartiendo puerto con HTTP | done | critical | medium | T003 |
| T005 | DB Connection | Configurar mssql pool | db-architect | Connection pool, .env con credenciales, health check endpoint | done | critical | medium | T003 |
| T006 | Migrations Base | Script de migraciones SQL | db-architect | 3 scripts: fix typos, nuevas columnas, 7 tablas nuevas | done | critical | medium | T005 |
| T007 | CLAUDE.md | Configurar agentes y convenciones | senior-architect | Definir agentes, naming, estructura de archivos | done | high | low | — |
| T008 | Git Init | Inicializar repo + .gitignore | senior-architect | Monorepo con /app y /server, .gitignore para node_modules, .env | done | high | low | T001, T003 |

## Fase 1 — Design System (T101-T109)

| ID | Feature | Tasks | Agents & Plugins | Description | Status | Priority | Complexity | Dependencies |
|----|---------|-------|-------------------|-------------|--------|----------|------------|--------------|
| T101 | Theme | Definir design tokens | mobile-ui, frontend-design | colors, typography, spacing, radius, shadows, motion | done | critical | medium | T001 |
| T102 | Button | Componente Button reutilizable | mobile-ui, frontend-design | 5 variantes, 3 sizes, animated scale, loading state | done | high | low | T101 |
| T103 | Input | Componente TextInput custom | mobile-ui, frontend-design | Label, error, left icon, password toggle, focus glow | done | high | low | T101 |
| T104 | Card | Componente Card | mobile-ui, frontend-design | Imagen 4:3, badge categoria, precio Playfair, press scale | done | high | low | T101 |
| T105 | Modal | Componente Modal | mobile-ui, frontend-design | Center + bottom sheet, drag handle, overlay blur | done | medium | medium | T101 |
| T106 | Badge | Componente Badge | mobile-ui, frontend-design | 5 categorias con colores unicos, border oro/platino | done | medium | low | T101 |
| T107 | Avatar | Componente Avatar | mobile-ui, frontend-design | 4 sizes, fallback iniciales, gold accent | done | low | low | T101 |
| T108 | Loading | Estados de carga | mobile-ui, frontend-design | Skeleton shimmer, Spinner rotacion, CardSkeleton | done | medium | low | T101 |
| T109 | Icons | Setup de iconografia | mobile-ui | @expo/vector-icons (Ionicons) integrado | done | medium | low | T001 |

## Fase 2 — Auth & Users (T201-T210)

| ID | Feature | Tasks | Agents & Plugins | Description | Status | Priority | Complexity | Dependencies |
|----|---------|-------|-------------------|-------------|--------|----------|------------|--------------|
| T201 | Registro Etapa 1 | Formulario datos personales | mobile-ui, api-developer | Nombre, documento (foto frente/dorso), domicilio, pais | done | critical | high | T103, T006 |
| T202 | Registro Etapa 1 API | POST /auth/register/step1 | api-developer, db-architect | Persona + cliente pendiente, express-validator | done | critical | high | T005, T006 |
| T203 | Registro Etapa 2 | Completar registro + clave | mobile-ui, api-developer | Pantalla id + email + clave + confirmacion | done | critical | medium | T201 |
| T204 | Registro Etapa 2 API | POST /auth/register/step2 | api-developer | bcrypt hash, verificar admitido, activar cuenta | done | critical | medium | T202 |
| T205 | Login | Pantalla + endpoint login | mobile-ui, api-developer | JWT access + refresh, SecureStore, multas check | done | critical | medium | T204 |
| T206 | Auth Guard | Middleware JWT + categoryGuard | api-developer | authGuard + categoryGuard(min), validate middleware | done | critical | medium | T205 |
| T207 | Medios de Pago | CRUD medios de pago API | mobile-ui, api-developer, db-architect | GET/POST/PUT/DELETE, soft delete, 3 tipos | done | high | high | T206, T006 |
| T208 | Perfil | Pantalla de perfil usuario | mobile-ui, api-developer | Avatar, badge categoria, datos, logout, GET /auth/me | done | high | medium | T206 |
| T209 | Auth Navigation | Guards de navegacion | mobile-ui | Root layout redirect, useSegments, loadUser on mount | done | high | medium | T205 |
| T210 | Upload Documento | Subir fotos documento | mobile-ui, api-developer | expo-image-picker integrado en step1 (Cloudinary TODO) | done | high | medium | T201 |

## Fase 3 — Catalogo & Browse (T301-T308)

| ID | Feature | Tasks | Agents & Plugins | Description | Status | Priority | Complexity | Dependencies |
|----|---------|-------|-------------------|-------------|--------|----------|------------|--------------|
| T301 | Lista Subastas | Pantalla listado subastas | mobile-ui, api-developer | FlatList + filtros (todas/abierta/cerrada), pull-to-refresh | done | critical | medium | T206 |
| T302 | Lista Subastas API | GET /subastas | api-developer, db-architect | Paginacion OFFSET/FETCH, filtros estado+categoria | done | critical | medium | T005 |
| T303 | Catalogo | Pantalla catalogo de una subasta | mobile-ui, api-developer | Grid 2 columnas con Card, precio condicional | done | critical | medium | T301, T104 |
| T304 | Catalogo API | GET /subastas/:id/catalogo | api-developer, db-architect | optionalAuth, precio solo si JWT presente | done | critical | medium | T302 |
| T305 | Detalle Item | Pantalla detalle de pieza | mobile-ui, api-developer | Gallery placeholder, precio Playfair gold, detalles, info subasta | done | high | high | T303 |
| T306 | Detalle Item API | GET /subastas/items/:id | api-developer, db-architect | Info completa + fotos IDs + datos dueno + subasta | done | high | medium | T304 |
| T307 | Control Acceso Categoria | Validar acceso por categoria | api-developer | categoryGuard en getCatalogo, order array check | done | critical | medium | T302, T206 |
| T308 | Catalogo Publico | Vista publica sin precio | mobile-ui, api-developer | optionalAuth: sin token no muestra precioBase ni comision | done | medium | low | T303 |

## Fase 4 — Subasta en Vivo (T401-T410)

| ID | Feature | Tasks | Agents & Plugins | Description | Status | Priority | Complexity | Dependencies |
|----|---------|-------|-------------------|-------------|--------|----------|------------|--------------|
| T401 | Socket Room | Room por subasta activa | api-developer | join-auction, leave-auction, JWT auth middleware socket | done | critical | high | T004 |
| T402 | Restriccion 1 Subasta | Validar 1 conexion por usuario | api-developer | userConnections Map, check before join, cleanup on disconnect | done | critical | medium | T401 |
| T403 | UI Subasta Live | Pantalla subasta en tiempo real | mobile-ui | Dark mode, precio Playfair hero gold, bid list, pulse animation | done | critical | high | T401, T305 |
| T404 | Validacion Pujas | Logica de limites min/max | api-developer | Min: ultima+1%base, Max: ultima+20%base, skip oro/platino | done | critical | high | T401 |
| T405 | Enviar Puja | Cliente envia puja via socket | mobile-ui, api-developer | place-bid con callback, blocking hasta confirmacion server | done | critical | high | T403, T404 |
| T406 | Broadcast Pujas | Emitir puja a todos los conectados | api-developer | new-bid event con bidId, importe, postorNombre, timestamp | done | critical | medium | T405 |
| T407 | Cierre Subasta | Determinar ganador | api-developer, db-architect | close-item: ganador=si, subastado=si, registroDeSubasta, you-won | done | critical | high | T406 |
| T408 | Seleccion Medio Pago | Elegir medio de pago al ganar | mobile-ui, api-developer | Modal bottom sheet post-victoria, importe+comision | done | high | medium | T407, T207 |
| T409 | Multas | Registrar multa por impago | api-developer, db-architect | POST /multas 10% penalty, 72hs deadline, notificacion, block check | done | high | medium | T407 |
| T410 | Garantia Cheque | Validar monto cheque certificado | api-developer | montoDisponible check en place-bid, deduct en close-item | done | high | medium | T207, T407 |

## Fase 5 — Venta de Items (T501-T508)

| ID | Feature | Tasks | Agents & Plugins | Description | Status | Priority | Complexity | Dependencies |
|----|---------|-------|-------------------|-------------|--------|----------|------------|--------------|
| T501 | Solicitud Venta | Formulario solicitud venta | mobile-ui, api-developer | Tabs nueva/mis, descripcion, datos historicos, fotos, declaracion | done | high | high | T206, T006 |
| T502 | Solicitud Venta API | POST /venta/solicitudes | api-developer, db-architect | CRUD solicitudes + PUT respuesta (acepta/rechaza valor base) | done | high | medium | T501 |
| T503 | Upload Fotos Item | Subir min 6 fotos | mobile-ui, api-developer | Multi-select image picker, validacion min 6, strip preview | done | high | medium | T501, T210 |
| T504 | Declaracion Propiedad | Switch obligatorio | mobile-ui | Switch + texto legal, validacion antes de submit | done | high | low | T501 |
| T505 | Resultado Inspeccion | Ver estado de solicitud | mobile-ui, api-developer | Lista con dot color por estado, motivo rechazo, valor base | done | medium | medium | T502 |
| T506 | Seguros | Ver poliza y ubicacion | mobile-ui, api-developer, db-architect | JOIN seguros+depositos en detalle solicitud | done | medium | high | T505 |
| T507 | Depositos | Tracking ubicacion pieza | api-developer, db-architect | depositoNombre+direccion en GET solicitudes/:id | done | medium | medium | T506 |
| T508 | Cuenta a la Vista | Declarar cuenta destino | mobile-ui, api-developer | GET/POST /venta/cuentas, banco+cuenta+moneda+pais | done | high | medium | T207 |

## Fase 6 — Metricas & Polish (T601-T610)

| ID | Feature | Tasks | Agents & Plugins | Description | Status | Priority | Complexity | Dependencies |
|----|---------|-------|-------------------|-------------|--------|----------|------------|--------------|
| T601 | Estadisticas Usuario | Dashboard metricas | mobile-ui, api-developer | Subastas asistidas, ganadas, historial pujas, importes | done | high | high | T407 |
| T602 | Estadisticas API | GET /usuarios/:id/estadisticas | api-developer, db-architect | Queries agregadas sobre pujos, registroDeSubasta | done | high | medium | T601 |
| T603 | Notificaciones | Sistema de notificaciones in-app | mobile-ui, api-developer, db-architect | Tabla notificaciones, badge count, lista de mensajes | done | high | high | T206, T006 |
| T604 | Mensaje Ganador | Notificacion privada al ganar | api-developer | Importe pujado + comisiones + costo envio | done | critical | medium | T407, T603 |
| T605 | Moneda Subasta | Soporte pesos y dolares | api-developer, db-architect | Columna moneda en subastas. Validar medio de pago compatible | done | high | medium | T006, T408 |
| T606 | Empresa Compra | Auto-compra si nadie puja | api-developer, db-architect | Si no hay pujas, empresa compra a precio base | done | medium | medium | T407 |
| T607 | Testing E2E | Tests end-to-end flujo completo | test-runner | Registro -> login -> catalogo -> puja -> pago | done | high | high | T407 |
| T608 | Testing Unitario | Tests unitarios backend | test-runner | Validaciones de puja, auth, medios de pago | done | high | medium | T404, T206 |
| T609 | API Docs | Documentar endpoints | api-developer | Swagger/OpenAPI para todos los endpoints | done | medium | medium | Todas las APIs |
| T610 | QA & Bug Fixes | Revision general de calidad | senior-architect, test-runner | Code review, performance, seguridad, UX polish | done | high | high | Todas |

---

## Verification Checklist

| # | Requerimiento TPO | Task(s) |
|---|-------------------|---------|
| 1 | Registro 2 etapas (datos personales + clave) | T201, T202, T203, T204 |
| 2 | Foto documento frente y dorso | T210 |
| 3 | Categorias: comun, especial, plata, oro, platino | T202, T307 |
| 4 | Al menos 1 medio de pago para pujar | T207, T405 |
| 5 | Medios: cuentas bancarias, tarjetas, cheques | T207 |
| 6 | Gestion medios de pago (CRUD) | T207 |
| 7 | Subasta: dia, horario, categoria, rematador, catalogo | T302 |
| 8 | Catalogos publicos, precio base solo registrados | T308, T304 |
| 9 | Datos item: nro pieza, descripcion, precio base, dueno, fotos | T306 |
| 10 | Obras arte: artista, fecha, historia | T306 |
| 11 | Acceso subasta: registrado + categoria <= propia | T307 |
| 12 | Solo puja con medio de pago verificado | T405 |
| 13 | Subasta dinamica ascendente, ofertas visibles | T403, T406 |
| 14 | Puja minima: ultima + 1% base | T404 |
| 15 | Puja maxima: ultima + 20% base | T404 |
| 16 | Limites no aplican oro/platino | T404 |
| 17 | Tiempo real: ofertas actualizadas al instante | T401, T406 |
| 18 | Cierre: nuevo dueno, registrar venta, comisiones | T407 |
| 19 | Mensaje privado ganador: pujado + comisiones + envio | T604 |
| 20 | Retiro personal pierde seguro | T604 (nota en mensaje) |
| 21 | Cheque: compras no superan monto | T410 |
| 22 | Multa 10% si no paga, 72hs para fondos | T409 |
| 23 | Impago: deriva justicia, bloqueo acceso | T409 |
| 24 | No mas de 1 subasta simultanea | T402 |
| 25 | Subastas en pesos o dolares (no bimonetaria) | T605 |
| 26 | Guardar todos los pujes en orden | T405, T406 |
| 27 | Metricas: participacion, ganadas, historial, importes | T601, T602 |

---

## Task ID Summary

| Fase | Rango | Cantidad |
|------|-------|----------|
| Fase 0 — Project Setup | T001-T008 | 8 |
| Fase 1 — Design System | T101-T109 | 9 |
| Fase 2 — Auth & Users | T201-T210 | 10 |
| Fase 3 — Catalogo & Browse | T301-T308 | 8 |
| Fase 4 — Subasta en Vivo | T401-T410 | 10 |
| Fase 5 — Venta de Items | T501-T508 | 8 |
| Fase 6 — Metricas & Polish | T601-T610 | 10 |
| **Total** | | **63** |
