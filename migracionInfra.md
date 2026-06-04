# Migración de Infraestructura — Sistema de Subastas

Roadmap de la migración del proyecto a infraestructura cloud (Azure) para un uso
**temporal (~45 días)** de demo/entrega del TPO. Rama de trabajo: `Migracion-Infra`.

---

## 1. Objetivo

Mover la base de datos (y eventualmente el backend) de SQL Server local a Azure,
aprovechando la cuenta **Azure for Students** (mail `@uade.edu.ar`, ~USD 100 de
crédito), de forma que la app sea accesible sin depender del entorno local.

Restricción clave: el proyecto usa **SQL Server** (`mssql`/tedious), por lo que
**Azure SQL Database** es el destino natural (lift & shift, sin reescribir queries).

---

## 2. Decisiones de arquitectura

| Tema | Decisión | Motivo |
|------|----------|--------|
| Base de datos | **Azure SQL Database (free offer)** | Serverless GP, gratis de por vida, $0, no toca el crédito |
| Migrar a Postgres | ❌ Descartado | Uso temporal — no justifica reescribir los 7 controllers |
| Backend (deploy) | ⏳ Pendiente de decidir | Opción A: VM con backend+DB en Docker · Opción B: VM backend + Azure SQL |
| Región | **Canada Central** | Única región permitida por la policy que acepta servidores **y** soporta el free offer |

> **Nota sobre regiones:** la suscripción de estudiante tiene una policy
> *"Allowed resource deployment regions"* que permite solo:
> `northcentralus, southcentralus, canadacentral, eastus2, chilecentral`.

---

## 3. Recursos creados en Azure

| Recurso | Valor |
|---------|-------|
| Resource group | `rg-subastas` |
| SQL Server | `subastas-uade-cac` → FQDN `subastas-uade-cac.database.windows.net` |
| Base de datos | `subastas` (Serverless GP, `useFreeLimit=true`, `AutoPause`) |
| Región | Canada Central |
| Admin login | `subastasadmin` |
| Password | **En `server/.env`** (gitignoreado — no se versiona) |
| Connection policy | **Proxy** ✅ (aplicada) |
| Firewall | `AllowAzureServices` (0.0.0.0) + `ClientIP-fvasquez` + `ClientIP-casa-fvasquez` + `VM-subastas-api` |
| **VM backend** | `subastas-api` → **`subastas-api-fvasquez.canadacentral.cloudapp.azure.com`** (IP `20.63.47.115`) |
| VM specs | **Standard_B2pls_v2** — Ubuntu 22.04 LTS **ARM64 (aarch64)**, 2 vCPU, 4 GB RAM |
| VM acceso | usuario `azureuser`, clave SSH `~/.ssh/subastas_vm` (privada, no se versiona); puertos 22/80/443 abiertos |

> **Nota VM:** la suscripción de estudiante tiene **bloqueadas todas las B-series x86**
> (`NotAvailableForSubscription`) en las regiones permitidas → se usó **ARM64**
> (Ampere `B2pls_v2`), que corre Node/PM2/Caddy sin problema.

---

## 4. Estado del roadmap

### Fase 0 — Setup de herramientas
- [x] Instalar Azure CLI (`az`) vía winget
- [x] `az login` (cuenta `fvasquez@uade.edu.ar`, MFA recuperado)
- [x] Agregar `az` al PATH del sistema

### Fase 1 — Provisión de la base de datos
- [x] Crear resource group `rg-subastas`
- [x] Crear SQL Server `subastas-uade-cac` (Canada Central)
- [x] Crear base `subastas` con **free offer** (serverless, auto-pause)
- [x] Reglas de firewall (servicios Azure + IP del cliente)
- [x] Eliminar servidor fantasma de Chile (`subastas-uade-2026`)

### Fase 2 — Carga del schema (sobre `main` / entrega 2)
- [x] Crear `server/.env` apuntando a Azure
- [x] `npm install` / `npm ci` en `server/`
- [x] Usar el runner de `main`: **`server/run-migrations.js`** (tabla `schema_version`, idempotente, separadores `GO`, rollback `-- @DOWN`)
- [x] **Recrear el schema desde cero** (DB vacía) → baseline + migraciones `004`–`014`
- [x] Verificar tablas creadas ✅ (**30 tablas** + `schema_version` con las 12 entradas)

> ⚠️ Las primeras corridas se hicieron sobre la rama vieja `Migracion-Infra` (23→28
> tablas con un `run-azure-migration.js` ad-hoc). Al detectar que `main` (entrega 2)
> era la app real, se **rehízo** todo sobre `main` (ver problema #11).

### Fase 3 — Backend (desde `main`)
- [x] Verificar conexión a Azure → `GET /api/health` = `{db: connected}` ✅
- [x] **Deploy del backend — Opción B (VM + Azure SQL)** ✅
  - [x] VM con Node 22 + PM2 (proceso `subastas-api`, auto-start tras reboot)
  - [x] Caddy reverse proxy con **HTTPS automático** (Let's Encrypt)
  - [x] Fix `connectionTimeout=60000` en `db.ts` (auto-pause del serverless)
  - [x] Fix `tsconfig` (`include: src` — evitaba rebuild por TS5055)
  - [x] VM corriendo el código de `main` (rama `infra/azure-deploy`) ✅
  - [x] **Endpoints OK (HTTPS):** `/api/health` 200 · `/api/subastas` 200 · `/api/admin/clientes` 401 · `/api/docs` 200
- [ ] Configurar `CORS_ORIGINS` (se completa en Fase E con la URL del web)

### Fase 4 — Frontend
- [ ] Apuntar `app/.env` → `EXPO_PUBLIC_API_URL=https://subastas-api-fvasquez.canadacentral.cloudapp.azure.com/api`
- [ ] Socket.IO ya deriva la URL quitando `/api` (no requiere cambio de código)
- [ ] Web → Azure Static Web Apps · Mobile → EAS Build / Expo Go

---

## 5. Problemas encontrados y soluciones

| # | Problema | Solución |
|---|----------|----------|
| 1 | MFA perdido (cambio de celular) | Recuperado / IT de UADE resetea MFA |
| 2 | `RequestDisallowedByAzure` en Brazil South | Policy de regiones → usar región permitida |
| 3 | `RegionDoesNotAllowProvisioning` (eastus2, southcentralus, northcentralus) | Sin capacidad → probar otras regiones |
| 4 | Servidor fantasma reservando el nombre en eastus2 | Usar nombre nuevo por intento |
| 5 | `ProvisioningDisabled` free offer en Chile Central | El free offer no está en todas las regiones → Canada Central |
| 6 | **`ECONNRESET` al conectar desde Node** | **Causa real: red de UADE (FortiGate) cortaba la salida al 1433.** Desde red doméstica conecta OK. La connection policy ya estaba en `Proxy`. |
| 7 | `Login failed for user 'subastasadmin'` | `dotenv` cortaba la password en el `#` (la leía como comentario) → solo tomaba 4 chars. **Fix: encomillar el valor en `.env`** (`DB_PASSWORD="...#..."`). |
| 8 | `Invalid object name 'productoArticulos'` en `GET /api/subastas` | Las tablas del feature de artículos múltiples se creaban de forma **perezosa** en `ventaController.ensureVentaSchema()`. En la rama vieja se parchó con una `005` ad-hoc; **en `main` ya está resuelto** por la migración `008_venta_schema.sql`. |
| 9 | `ETIMEOUT: Failed to connect ... in 15000ms` en la VM | El serverless con **auto-pause** tarda ~30-60s en despertar; el `connectionTimeout` default (15s) no alcanza. **Fix: `connectionTimeout`/`requestTimeout`=60000 en `db.ts`** (configurable por env). |
| 10 | `TS5055: Cannot write file dist/...d.ts` al recompilar | El `exclude` explícito del `tsconfig` anulaba el default y tsc tomaba los `.d.ts` de `dist/` como input en el 2º build (rompería el CD). **Fix: agregar `include: ["src/**/*"]` y `dist` al `exclude`.** |
| 11 | **Se había deployado una versión vieja** | El trabajo de infra arrancó en `Migracion-Infra`, rama nacida de un commit **pre-entrega-2**. `main` (canónica, incluye `master`) tenía el panel admin + migraciones `004`–`014` sin aplicar. **Fix: rebasar la infra sobre `main`** (rama `infra/azure-deploy`, PR #2), recrear el schema y redeployar la VM contra `main`. Se descartó la `005` ad-hoc y el `run-azure-migration.js`. |

> ✅ **Trabajo consolidado en `infra/azure-deploy`** (sale de `main`, solo suma) →
> **PR #2** hacia `main`. Los commits viejos en `Migracion-Infra` quedan obsoletos.
> El CD deploya desde `main` con `git reset --hard`, así la VM converge al mergear.

---

## 6. Próximos pasos inmediatos

1. ~~Schema en Azure~~ ✅ (30 tablas, desde `main`) · ~~Backend en VM por HTTPS~~ ✅ · ~~Rebase sobre main + PR #2~~ ✅ · ~~Secrets del CD~~ ✅
2. **Mergear PR #2 → `main`** → dispara el CD (pasa la VM a `main` y redeploya) + el CI.
3. **Fase E — Web** en Azure Static Web Apps + setear `CORS_ORIGINS` en la VM (ver §11).
4. **Mobile** — copiar `app/.env.example` → `app/.env` + `eas build`.

### Datos de la VM (referencia rápida)
- **SSH:** `ssh -i ~/.ssh/subastas_vm azureuser@20.63.47.115`
- **App:** PM2 proceso `subastas-api` en `~/app-subastas/server` (`pm2 logs subastas-api`)
- **Proxy:** Caddy, `/etc/caddy/Caddyfile` (HTTPS auto)
- **API pública:** `https://subastas-api-fvasquez.canadacentral.cloudapp.azure.com/api`

### Encender / apagar la VM (ahorro de crédito)
> El auto-shutdown **nativo** está bloqueado por la policy de regiones del subscription
> (intenta crear `Microsoft.DevTestLab/schedules` y lo rechaza). Alternativa manual:
```powershell
az vm deallocate -g rg-subastas -n subastas-api   # apaga y deja de facturar cómputo
az vm start      -g rg-subastas -n subastas-api   # enciende; Caddy + PM2 arrancan solos
```
> La IP `20.63.47.115` y el dominio se mantienen (IP Standard estática).
> Automatizable luego con un cron de GitHub Actions + service principal.

---

## 7. Cómo retomar en OTRA máquina (bootstrap)

> El deploy vive en `main` (o `infra/azure-deploy` hasta mergear el PR #2). En la
> máquina nueva, seguí estos pasos en orden. Ojo con dos cosas que **no** vienen
> del repo: el `server/.env` (gitignoreado) y la **IP del firewall** (cada máquina
> tiene IP pública distinta).

```powershell
# 1) Clonar y pararse en la rama de deploy
git clone https://github.com/AlvaFG/app-subastas.git
cd app-subastas
git checkout main          # o infra/azure-deploy si el PR #2 sigue abierto

# 2) Azure CLI (si no está) + login con tu cuenta personal/educativa
winget install -e --id Microsoft.AzureCLI --accept-package-agreements --accept-source-agreements
#   reabrir la terminal, luego:
az login                     # cuenta fvasquez@uade.edu.ar (MFA)

# 3) Habilitar la IP pública de ESTA máquina en el firewall del SQL Server
$ip = (Invoke-RestMethod https://api.ipify.org)
az sql server firewall-rule create -g rg-subastas -s subastas-uade-cac `
  -n ClientIP-maquina2 --start-ip-address $ip --end-ip-address $ip

# 4) Recrear server/.env (NO está en el repo). Usar la password que guardaste.
#    Plantilla en el bloque de abajo (§9). DB_PASSWORD = la del admin subastasadmin.

# 5) Dependencias del backend
npm install --prefix server
```

Una vez hecho lo anterior, para (re)crear el schema en Azure correr el runner de
`main`: `node server/run-migrations.js` (idempotente, trackea en `schema_version`).

---

## 8. Comandos de referencia

```powershell
# Ruta del CLI (si no está en PATH de la terminal actual)
$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

# Estado de la base
& $az sql db show -g rg-subastas -s subastas-uade-cac -n subastas `
  --query "{db:name, estado:status, freeOffer:useFreeLimit}" -o json

# Actualizar la IP del cliente en el firewall (si cambia)
& $az sql server firewall-rule create -g rg-subastas -s subastas-uade-cac `
  -n ClientIP-fvasquez --start-ip-address <IP> --end-ip-address <IP>
```

---

## 9. Plantilla `server/.env`

> Este archivo **no se versiona** (está en `.gitignore`). Recrealo en cada máquina.
> `DB_PASSWORD` es la del admin `subastasadmin` que guardaste al crear el servidor.

```env
PORT=3000
DB_USER=subastasadmin
DB_PASSWORD=<la-password-del-admin-que-guardaste>
DB_SERVER=subastas-uade-cac.database.windows.net
DB_NAME=subastas
DB_PORT=1433
DB_ENCRYPT=true
NODE_ENV=production

JWT_SECRET=<string-largo-aleatorio>
JWT_REFRESH_SECRET=<otro-string-largo-aleatorio-distinto>

# Se completa con la URL del front web (Static Web Apps) para habilitar CORS
CORS_ORIGINS=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## 10. CI/CD (GitHub Actions)

Stack elegido: backend en VM con **PM2 + git pull** · web en **Azure Static Web Apps** · **CI completo**.
Los workflows están en la rama `infra/azure-deploy` (PR #2):

| Archivo | Qué hace | Dispara |
|---------|----------|---------|
| `.github/workflows/ci.yml` | Backend: `npm ci` → `tsc` → `jest` (DB mockeada). Frontend: `tsc --noEmit` + `expo lint`. | PRs y push a `main`/`master`/`Migracion-Infra` |
| `.github/workflows/deploy-backend.yml` | SSH a la VM → `git reset --hard origin/main` → `npm ci` → `build` → `pm2 reload` → health check | Push a `main` que toque `server/**` (o manual) |

### Secrets del CD — ✅ ya cargados (`gh secret set`)
> Acceso **Admin** al repo confirmado (ver *Settings → Secrets and variables*).

| Secret | Valor |
|--------|-------|
| `VM_HOST` | `20.63.47.115` |
| `VM_USER` | `azureuser` |
| `VM_SSH_KEY` | clave privada `~/.ssh/subastas_vm` (cargada como secret) |

Opcional, en la pestaña **Variables**: `DEPLOY_BRANCH` (default `main`).

> ⚠️ **Coherencia de rama:** la VM tiene el repo en `~/app-subastas` en `infra/azure-deploy`.
> El CD hace `git checkout main && git reset --hard origin/main`, así al **mergear el PR #2**
> el primer deploy pasa la VM a `main` automáticamente.

### Re-cargar el secret de la clave (si hiciera falta)
```powershell
gh secret set VM_SSH_KEY -R AlvaFG/app-subastas < "$env:USERPROFILE\.ssh\subastas_vm"
```

---

## 11. Frontend (web + mobile)

El backend en la VM es la **API común** para ambas plataformas. Solo cambia el empaquetado.

### Web — Azure Static Web Apps (free)
1. Portal Azure → crear **Static Web App** (Free) enlazada al repo `AlvaFG/app-subastas`
   (genera su propio workflow de GitHub Actions).
2. Build config: app location `app`, output `dist`, comando `npx expo export -p web`.
3. Variable de entorno del build: `EXPO_PUBLIC_API_URL=https://subastas-api-fvasquez.canadacentral.cloudapp.azure.com/api`.
4. Cuando se sepa la URL `*.azurestaticapps.net`, **agregarla a `CORS_ORIGINS`** en el
   `server/.env` de la VM y `pm2 restart subastas-api`.

### Mobile — EAS / Expo Go
```powershell
Copy-Item app/.env.example app/.env   # ya apunta al backend HTTPS de la VM
# Expo Go: npm run start   |   APK: eas build -p android
```

