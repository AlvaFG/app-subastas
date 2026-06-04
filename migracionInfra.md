# Migración de Infraestructura — Sistema de Subastas

Despliegue del proyecto (entrega 2 / rama `main`) en **Azure for Students** para
un uso de demo/entrega del TPO. **Estado: desplegado y funcionando**, con CI/CD
automático desde `main`.

## URLs de producción

| Servicio | URL |
|----------|-----|
| **Web** (Azure Static Web Apps) | **https://witty-ocean-0b3e6550f.7.azurestaticapps.net** |
| **API** (backend en VM, HTTPS) | **https://subastas-api-fvasquez.canadacentral.cloudapp.azure.com/api** |
| **Health check** | `…/api/health` → `{success:true, data:{db:"connected"}}` |
| **Swagger** | `…/api/docs` |

---

## 1. Objetivo

Mover **base de datos + backend** de SQL Server local a Azure, aprovechando la
cuenta **Azure for Students** (mail `@uade.edu.ar`, ~USD 100 de crédito), de forma
que la app sea accesible (web y mobile) sin depender del entorno local.

Restricción clave: el proyecto usa **SQL Server** (`mssql`/tedious), por lo que
**Azure SQL Database** es el destino natural (lift & shift, sin reescribir queries).

---

## 2. Decisiones de arquitectura

| Tema | Decisión | Motivo |
|------|----------|--------|
| Base de datos | **Azure SQL Database (free offer)** | Serverless GP, $0, no toca el crédito |
| Migrar a Postgres | ❌ Descartado | Uso temporal — no justifica reescribir los controllers |
| Backend (deploy) | **Opción B: VM (Node+PM2) + Azure SQL** | La DB ya está en Azure SQL; la VM solo corre el backend |
| Web | **Azure Static Web Apps (Free)** | Tier gratis, HTTPS + CDN, CI/CD nativo, no carga la VM |
| Reverse proxy / TLS | **Caddy** | HTTPS automático (Let's Encrypt) sobre el dominio de la VM |
| Región DB + VM | **Canada Central** | Permitida por la policy **y** soporta el free offer |
| Región Web (SWA) | **East US 2** | Región de SWA permitida por la policy |

> **Nota sobre regiones:** la suscripción de estudiante tiene una policy
> *"Allowed resource deployment regions"* que permite solo:
> `northcentralus, southcentralus, canadacentral, eastus2, chilecentral`.

---

## 3. Recursos creados en Azure

| Recurso | Valor |
|---------|-------|
| Resource group | `rg-subastas` |
| SQL Server | `subastas-uade-cac` → FQDN `subastas-uade-cac.database.windows.net` |
| Base de datos | `subastas` (Serverless GP, `useFreeLimit=true`, `AutoPause`) — **30 tablas** |
| Admin login | `subastasadmin` (password en `server/.env`, no se versiona) |
| Connection policy | **Proxy** |
| Firewall SQL | `AllowAzureServices` (0.0.0.0) + reglas `ClientIP-*` + `VM-subastas-api` |
| **VM backend** | `subastas-api` → **`subastas-api-fvasquez.canadacentral.cloudapp.azure.com`** (IP `20.63.47.115`) |
| VM specs | **Standard_B2pls_v2** — Ubuntu 22.04 LTS **ARM64**, 2 vCPU, 4 GB RAM |
| VM acceso | usuario `azureuser`, clave SSH `~/.ssh/subastas_vm`; puertos 22/80/443 |
| **Static Web App** | `subastas-web` (Free, East US 2) → `witty-ocean-0b3e6550f.7.azurestaticapps.net` |

> **Nota VM:** la suscripción tiene **bloqueadas las B-series x86**
> (`NotAvailableForSubscription`) en las regiones permitidas → se usó **ARM64**
> (Ampere `B2pls_v2`), que corre Node/PM2/Caddy sin problema.

---

## 4. Estado del roadmap

### Fase 0 — Setup de herramientas ✅
- [x] Azure CLI (`az`) vía winget + `az login` (`fvasquez@uade.edu.ar`, MFA)

### Fase 1 — Base de datos ✅
- [x] Resource group `rg-subastas` + SQL Server `subastas-uade-cac` (Canada Central)
- [x] Base `subastas` con **free offer** (serverless, auto-pause)
- [x] Reglas de firewall (servicios Azure + IPs de cliente + IP de la VM)

### Fase 2 — Schema (desde `main` / entrega 2) ✅
- [x] `server/.env` apuntando a Azure
- [x] Runner de `main`: **`server/run-migrations.js`** (tabla `schema_version`, idempotente, `GO`, rollback `-- @DOWN`)
- [x] **Schema recreado desde cero** → baseline + migraciones `004`–`014`
- [x] **30 tablas** + `schema_version` con las 12 entradas

### Fase 3 — Backend en VM ✅
- [x] VM con Node 22 + PM2 (proceso `subastas-api`, auto-start tras reboot)
- [x] Caddy reverse proxy con **HTTPS automático** (Let's Encrypt)
- [x] Fix `connectionTimeout=60000` en `db.ts` (auto-pause del serverless)
- [x] Fix `tsconfig` (`include: src` + `exclude: dist` — evitaba TS5055 en el CD)
- [x] VM corriendo el código de `main`
- [x] **Endpoints OK (HTTPS):** `/api/health` 200 · `/api/subastas` 200 · `/api/admin/clientes` 401 · `/api/docs` 200
- [x] `CORS_ORIGINS` con la URL del web (verificado: `Access-Control-Allow-Origin` OK)

### Fase 4 — Frontend ✅ (web) · ⏳ (mobile)
- [x] **Wrapper de storage multiplataforma** `app/src/services/storage.ts` (SecureStore nativo / localStorage web)
- [x] Web desplegada en Static Web Apps + `EXPO_PUBLIC_API_URL` al backend HTTPS
- [x] Socket.IO deriva su URL quitando `/api` (sin cambios de código)
- [ ] **Mobile** — `app/.env` (ya listo) + `eas build -p android` o Expo Go

### Fase 5 — CI/CD ✅
- [x] CI (build+jest backend, lint+typecheck frontend) en PRs y push a `main`
- [x] CD backend (SSH a la VM) — verde en `main` (PR #2)
- [x] CD web (export + Static Web Apps) — verde en `main` (PR #3)

---

## 5. Problemas encontrados y soluciones

| # | Problema | Solución |
|---|----------|----------|
| 1 | MFA perdido (cambio de celular) | Recuperado / IT de UADE resetea MFA |
| 2 | `RequestDisallowedByAzure` en Brazil South | Policy de regiones → usar región permitida |
| 3 | `RegionDoesNotAllowProvisioning` (varias regiones) | Sin capacidad → probar otras |
| 4 | Servidor fantasma reservando el nombre | Usar nombre nuevo por intento |
| 5 | `ProvisioningDisabled` free offer en Chile Central | El free offer no está en todas las regiones → Canada Central |
| 6 | **`ECONNRESET` al conectar desde Node** | **Causa real: red de UADE (FortiGate) cortaba la salida al 1433.** Desde red doméstica conecta OK. |
| 7 | `Login failed for user 'subastasadmin'` | `dotenv` cortaba la password en el `#` → solo tomaba 4 chars. **Fix: encomillar el valor en `.env`** (`DB_PASSWORD="...#..."`). |
| 8 | `Invalid object name 'productoArticulos'` | Las tablas se creaban de forma perezosa en `ventaController`. **En `main` ya está resuelto** por la migración `008_venta_schema.sql`. |
| 9 | `ETIMEOUT ... in 15000ms` en la VM | Auto-pause del serverless tarda ~30-60s en despertar. **Fix: `connectionTimeout`/`requestTimeout`=60000 en `db.ts`** (configurable por env). |
| 10 | `TS5055: Cannot write file dist/...d.ts` | El `exclude` del `tsconfig` anulaba el default y tomaba `dist/*.d.ts` como input. **Fix: `include: ["src/**/*"]` + `dist` en `exclude`.** |
| 11 | **Se había deployado una versión vieja** | El trabajo arrancó en `Migracion-Infra`, rama **pre-entrega-2**. `main` (incluye `master`) tenía el panel admin + migraciones `004`–`014`. **Fix: rebasar la infra sobre `main`** (`infra/azure-deploy`, PR #2), recrear el schema y redeployar. |
| 12 | Auth no funcionaba en web (`expo-secure-store`) | `expo-secure-store` es solo nativo. **Fix: wrapper `storage.ts`** (SecureStore en nativo, `localStorage` en web) — PR #3. |
| 13 | `MissingSubscriptionRegistration: Microsoft.Web` al crear la SWA | Resource provider no registrado. **Fix: `az provider register --namespace Microsoft.Web`** (una sola vez). |
| 14 | Auto-shutdown nativo de la VM bloqueado | La policy de regiones rechaza el recurso `Microsoft.DevTestLab/schedules`. **Workaround: `az vm deallocate`/`start` manual** (ver §6). |

---

## 6. Operación y próximos pasos

### Estado actual
Backend + web **desplegados y con CI/CD activo**. Cada push a `main`:
- toca `server/**` → redeploya el backend en la VM,
- toca `app/**` → rebuildea y republica la web en Static Web Apps.

### Pendiente (opcional)
1. **Mobile** — copiar `app/.env.example` → `app/.env` + `eas build -p android` (o Expo Go).
2. **Limpieza** — borrar la rama obsoleta `Migracion-Infra` (local + remoto).

### Datos de la VM (referencia rápida)
- **SSH:** `ssh -i ~/.ssh/subastas_vm azureuser@20.63.47.115`
- **App:** PM2 proceso `subastas-api` en `~/app-subastas/server` (`pm2 logs subastas-api`)
- **Proxy:** Caddy, `/etc/caddy/Caddyfile` (HTTPS auto)

### Encender / apagar la VM (ahorro de crédito)
> El auto-shutdown **nativo** está bloqueado por la policy de regiones (problema #14).
> Alternativa manual:
```powershell
az vm deallocate -g rg-subastas -n subastas-api   # apaga y deja de facturar cómputo
az vm start      -g rg-subastas -n subastas-api   # enciende; Caddy + PM2 arrancan solos
```
> La IP `20.63.47.115` y el dominio se mantienen (IP Standard estática).

---

## 7. Cómo retomar en OTRA máquina (bootstrap)

> El deploy vive en `main`. Dos cosas **no** vienen del repo: el `server/.env`
> (gitignoreado) y la **IP del firewall** (cada máquina tiene IP pública distinta).

```powershell
# 1) Clonar
git clone https://github.com/AlvaFG/app-subastas.git
cd app-subastas        # rama main

# 2) Azure CLI (si no está) + login
winget install -e --id Microsoft.AzureCLI --accept-package-agreements --accept-source-agreements
#   reabrir la terminal, luego:
az login                     # cuenta fvasquez@uade.edu.ar (MFA)

# 3) Habilitar la IP pública de ESTA máquina en el firewall del SQL Server
$ip = (Invoke-RestMethod https://api.ipify.org)
az sql server firewall-rule create -g rg-subastas -s subastas-uade-cac `
  -n ClientIP-maquina2 --start-ip-address $ip --end-ip-address $ip

# 4) Recrear server/.env (NO está en el repo). Plantilla en §9.

# 5) Dependencias del backend
npm install --prefix server
```

Para (re)crear el schema en Azure: `node server/run-migrations.js`
(idempotente, trackea en `schema_version`).

---

## 8. Comandos de referencia

```powershell
# Estado de la base
az sql db show -g rg-subastas -s subastas-uade-cac -n subastas `
  --query "{db:name, estado:status, freeOffer:useFreeLimit}" -o json

# Actualizar la IP del cliente en el firewall (si cambia)
az sql server firewall-rule create -g rg-subastas -s subastas-uade-cac `
  -n ClientIP-fvasquez --start-ip-address <IP> --end-ip-address <IP>

# Token de deploy de la Static Web App
az staticwebapp secrets list -n subastas-web -g rg-subastas `
  --query properties.apiKey -o tsv
```

---

## 9. Plantilla `server/.env`

> Este archivo **no se versiona** (está en `.gitignore`). Recrealo en cada máquina.
> `DB_PASSWORD` es la del admin `subastasadmin`. Si tiene `#`, **encomillarla**.

```env
PORT=3000
DB_USER=subastasadmin
DB_PASSWORD="<la-password-del-admin>"
DB_SERVER=subastas-uade-cac.database.windows.net
DB_NAME=subastas
DB_PORT=1433
DB_ENCRYPT=true
NODE_ENV=production

JWT_SECRET=<string-largo-aleatorio>
JWT_REFRESH_SECRET=<otro-string-largo-aleatorio-distinto>

# URL del front web (Static Web Apps) para habilitar CORS
CORS_ORIGINS=https://witty-ocean-0b3e6550f.7.azurestaticapps.net

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## 10. CI/CD (GitHub Actions)

Workflows en `main` (`.github/workflows/`):

| Archivo | Qué hace | Dispara |
|---------|----------|---------|
| `ci.yml` | Backend: `npm ci` → `tsc` → `jest` (DB mockeada). Frontend: `tsc --noEmit` + `expo lint`. | PRs y push a `main`/`master` |
| `deploy-backend.yml` | SSH a la VM → `git reset --hard origin/main` → `npm ci` → `build` → `pm2 reload` → health check | Push a `main` que toque `server/**` |
| `deploy-web.yml` | `npm ci` → `expo export -p web` → deploy a Static Web Apps | Push a `main` que toque `app/**` |

### Secrets (✅ cargados en *Settings → Secrets and variables → Actions*)

| Secret | Para qué |
|--------|----------|
| `VM_HOST` | IP de la VM (`20.63.47.115`) |
| `VM_USER` | usuario SSH (`azureuser`) |
| `VM_SSH_KEY` | clave privada `~/.ssh/subastas_vm` |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | deployment token de la SWA |

> Flujo de iteración: rama → PR → CI valida → merge a `main` → se redeploya solo
> lo que cambió (backend y/o web). PRs históricos: **#2** (infra/backend), **#3** (web).

### Re-cargar secrets (si hiciera falta)
```powershell
gh secret set VM_SSH_KEY -R AlvaFG/app-subastas < "$env:USERPROFILE\.ssh\subastas_vm"
az staticwebapp secrets list -n subastas-web -g rg-subastas --query properties.apiKey -o tsv |
  gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN -R AlvaFG/app-subastas
```

---

## 11. Frontend (web + mobile)

El backend en la VM es la **API común** para ambas plataformas. Solo cambia el empaquetado.
El token JWT se guarda con el wrapper `app/src/services/storage.ts` (SecureStore en
nativo, `localStorage` en web).

### Web — Azure Static Web Apps ✅
- Recurso `subastas-web` (Free, East US 2) → https://witty-ocean-0b3e6550f.7.azurestaticapps.net
- Deploy automático vía `deploy-web.yml` (build `expo export -p web` + token de la SWA).
- `CORS_ORIGINS` del backend incluye esa URL.

### Mobile — EAS / Expo Go ⏳
```powershell
Copy-Item app/.env.example app/.env   # ya apunta al backend HTTPS de la VM
# Expo Go: npm run start   |   APK: eas build -p android
```
