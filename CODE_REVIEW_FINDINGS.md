# Informe de Code-Review + Verificacion de Requisitos — Sistema de Subastas

> Generado por la Fase A (find + verificacion adversarial, 80 agentes). 74 hallazgos.

## Estado de Resolución (Fase B + C)

Rama: `feature/code-review-fixes`. Verificación: backend `tsc` limpio + **99/99 tests Jest verdes**, frontend `tsc` limpio, smoke-test end-to-end en vivo (DB Docker + servidor), review final adversarial del diff (**0 regresiones confirmadas**).

**Aplicado (crítico→bajo):**
- **DB / migraciones:** sistema versionado nuevo (`run-migrations.js` + tabla `schema_version`, idempotente, con rollback `-- @DOWN`); baseline idempotente; nuevas migraciones `004`–`010` (multas.moneda, pujos.fechaPuja, índices+unicidad, documentosCliente, schema de venta, FK productos.seguro, lockout). Aplicadas y verificadas contra Docker.
- **Backend seguridad/auth:** categoría determinista `comun` (no más `Math.random` → escalada de privilegios); fotos de documento persistidas (Cloudinary con fallback a bytes); verificador real (no hardcode `1`); rotación + revocación de refresh token + logout; lockout anti fuerza-bruta; `validateEnv` al arrancar; error handler + 404; `optionalAuth` no-401 en rutas públicas; `categoryGuard` valida categoría conocida; endpoint de verificación de medios.
- **Backend lógica:** pujas **atómicas** (transacción + UPDLOCK/HOLDLOCK); cierre **por ítem** (multi-ítem, ya no cierra toda la subasta); tope de fondos/cheque en la puja; USD exige medio internacional; orden temporal de pujas; scheduler 72hs→justicia + bloqueo; envío por país; `cancel-payment` sin reabrir bajo el mínimo; eliminado el endpoint REST de puja inseguro; IN clause parametrizado; estadísticas separadas por moneda; upgrade de póliza usa el medio elegido.
- **Frontend:** reconexión de socket + estado de conexión + cleanup de listeners; lock de puja hasta ack (con timeout); detección de multa por `code` (no substring); `api.ts` timeout + guarda y rota refresh; polling con `AbortController` + `AppState`; tokens de tema (sin hex hardcodeados); `Modal` compartido reutilizado; validaciones de email/clave + `getApiErrorMessage`; tipos `any` reemplazados; utils compartidos (`validators`, `apiError`, `types`).

**Documentado / no implementado (decisión de alcance):**
- **BLOG-11:** entrega de fotos en base64 en respuestas (refactor a IDs/endpoint dedicado) — requiere cambio cliente+servidor coordinado; pendiente.
- **REQ-08:** "colecciones" de venta (agrupar múltiples ítems de un dueño en una subasta) — feature de alcance mayor; pendiente.
- **BLOG-03:** registro de venta en la auto-compra de la empresa — el modelo (`registroDeSubasta.cliente` FK a clientes) no representa a la empresa como comprador; se marca el ítem subastado + evento (limitación de modelo documentada).
- **Simplificaciones académicas** (sin panel admin externo): auto-aprobación del registro y verificación de medios marcadas como `verificado='si'` por defecto con comentarios.

## Resumen

- **Total hallazgos:** 74
- **Por accion:** {"fix":28,"fix-with-care":27,"report-only":18,"discard":1}
- **Por severidad (ajustada):** {"high":13,"low":29,"medium":30,"critical":1,"none":1}
- **Por categoria:** {"requirement-gap":13,"correctness":23,"security":12,"performance":3,"code-quality":10,"db":13}

Severidad: critical=seguridad/perdida de datos/rompe requisito core · high=bug funcional o seguridad media · medium=robustez/UX/perf · low=calidad.

---

## CRITICAL (1)

### [BSEC-01] Categoria de usuario asignada ALEATORIAMENTE en registro (incluye platino)
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** security · **Dominio:** Seguridad / Autenticacion
- **Ubicacion:** `server/src/controllers/authController.ts:95-96, 131`
- **Requisito TPO:** Categorias de cliente / acceso a subastas por categoria
- **Problema:** En registerStep2 la categoria del cliente se asigna con Math.random() sobre ['comun','especial','plata','oro','platino']. Cualquier usuario que se auto-registra obtiene una categoria al azar, pudiendo recibir 'platino' (la mas alta) sin ninguna evaluacion. La categoria controla a que subastas puede acceder/pujar (categoryGuard en middleware/auth.ts y canParticipateInAuction en el socket), por lo que es un control de autorizacion central decidido por azar. Un atacante puede simplemente re-registrarse hasta obtener oro/platino. Esto rompe un requisito de negocio core (la categoria debe derivarse de verificacion/historial del cliente, no del azar) y es una escalada de privilegios directa.
- **Fix propuesto:** Asignar categoria 'comun' por defecto en el registro y exponer el cambio de categoria solo via un proceso de verificacion/aprobacion de empleado (o regla determinista basada en historial). Nunca derivar autorizacion de Math.random(). Si por simplificacion academica no hay panel de verificacion, fijar 'comun' y documentar la simplificacion.

---

## HIGH (13)

### [REQ-01] Categoria asignada aleatoriamente, no por investigacion externa
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/controllers/authController.ts:95-96, 131`
- **Requisito TPO:** Req 3 (5 categorias asignadas tras verificacion)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El TPO exige que la categoria se asigne 'de acuerdo con la investigacion realizada' por la empresa tras verificar los datos personales (etapa 1). El codigo la asigna con Math.random() en registerStep2 (etapa 2, junto al email/clave), no en base a ninguna investigacion ni dato del postor. Ademas el alta de etapa 1 ya escribe categoria='comun' fija. Es una simplificacion academica (no hay panel de verificacion externo), pero el resultado actual es una categoria pseudo-aleatoria que no representa nada del proceso descripto.
- **Fix propuesto:** Separar la asignacion de categoria del flujo de etapa 2. Aunque no haya panel admin, reemplazar el random por una regla determinista documentada (p.ej. categoria base 'comun' al aprobar etapa 1, y mejora por diversidad de medios de pago/actividad como menciona el TPO), o exponer un endpoint admin para fijar la categoria tras 'investigacion'. Dejar comentado que es una simplificacion.

### [REQ-02] Fotos del documento (frente y dorso) nunca se persisten
- **Accion:** CORREGIR · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/controllers/authController.ts:11, 75`
- **Requisito TPO:** Req 2 (foto documento frente y dorso)
- **Problema:** El frontend (step1.tsx) obliga a subir fotoFrente y fotoDorso y las envia al backend, pero registerStep1 las recibe en req.body y nunca las guarda: solo queda un comentario TODO. No existe tabla ni columna para las fotos de documento. El requisito de capturar el documento queda solo en la UI; el dato se pierde en el servidor.
- **Fix propuesto:** Crear una tabla (p.ej. documentosCliente con columnas fotoFrente/fotoDorso VARBINARY(MAX) o URLs) o agregar columnas a clientes, e insertar las fotos recibidas en registerStep1 (decodificando el base64 como ya se hace en ventaController). Como minimo persistir las imagenes recibidas para cumplir el requisito de verificacion documental.

### [DB-03] Mismatch schema/codigo: columna multas.moneda usada por el codigo pero NO creada por el runner de migraciones
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/migrations/004_add_moneda_to_multas.sql:1-18`
- **Problema:** El codigo inserta en `multas` usando la columna `moneda` (auctionHandler.ts:684) y la lee condicionalmente (multasController.ts hasMultasMonedaColumn). Pero la columna `moneda` en `multas` SOLO se agrega en `server/migrations/004_add_moneda_to_multas.sql`, que NO esta referenciado por NINGUN runner: `run-unified-migrations.js` solo lee `unified-migrations.sql` (que define multas en L247-262 SIN moneda), y `run-migrations.js` referencia `src/migrations/001..003` que ni siquiera existen en disco. Resultado: en una base recien migrada con el flujo oficial, `multas.moneda` NO existe y el INSERT falla. El codigo lo enmascara con un try/catch que detecta 'invalid column name'/'moneda' (auctionHandler.ts:687-693) y reintenta sin moneda — sintoma claro de schema y codigo desincronizados.
- **Fix propuesto:** Mover el ADD de `moneda` a `multas` dentro de `unified-migrations.sql` (con `IF COL_LENGTH('multas','moneda') IS NULL`) en la fase de nuevas columnas, o incorporar 004 a un runner versionado. Asi se elimina el fallback try/catch y la columna existe siempre.

### [REQ-03] Todos los medios de pago se crean ya verificados; la verificacion por la empresa no existe
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/controllers/mediosPagoController.ts:52`
- **Requisito TPO:** Req 4 y 12 (>=1 medio verificado para pujar; solo puja con medio verificado)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** createMedioPago inserta verificado='si' de forma fija para cualquier medio creado por el usuario. El TPO exige que el medio sea 'verificado por la empresa' y que el cheque certificado sea 'entregado y verificado ANTES del inicio de la subasta'. Como todo medio nace verificado, las validaciones canBid (join-auction) y de moneda al pujar (que filtran por verificado='si') se cumplen siempre trivialmente: cualquier usuario que cargue un medio puede pujar. El control de 'medio verificado' queda neutralizado. Simplificacion academica al no haber backoffice, pero anula un requisito central.
- **Fix propuesto:** Insertar con verificado='no' (default del schema) y exponer un endpoint/flujo de verificacion (admin o auto-aprobacion diferida como se hace con solicitudes via setTimeout) que pase a 'si'. Asi las validaciones de pujo dejan de ser triviales y reflejan el requisito.

### [REQ-06] Incumplimiento de pago no deriva automaticamente a justicia ni bloquea tras 72hs
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/socket/auctionHandler.ts:668-738`
- **Requisito TPO:** Req 22 y 23 (multa 10% + 72hs; incumplimiento -> justicia + bloqueo total)
- **Problema:** Cuando el ganador no tiene fondos se crea la multa (10%) con fechaLimite a 72hs y se bloquea pujar mientras la multa este impaga (validacion pagada='no' en join/place-bid y en login). Pero no existe ningun proceso que, al vencer las 72hs sin pago, ponga derivadaJusticia='si' ni inactive al cliente. derivadaJusticia solo se LEE en login (authController:185) y nunca se ESCRIBE en ningun lado del codigo. El requisito 23 (derivar a justicia + no acceder a ningun servicio) queda sin disparador: el bloqueo total nunca ocurre automaticamente.
- **Fix propuesto:** Agregar un job/cron (o un setTimeout analogo al auto-accept de solicitudes) que al pasar fechaLimite con pagada='no' marque multas.derivadaJusticia='si' y personas.estado='inactivo'. Documentar que la derivacion judicial real esta fuera del alcance, pero el bloqueo de servicios debe activarse.

### [REQ-07] La subasta completa se cierra tras vender/impagar un solo item
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** requirements
- **Ubicacion:** `server/src/socket/auctionHandler.ts:734, 791`
- **Requisito TPO:** Req 7, 18 (subasta con catalogo de varios items; cierre por item)
- **Problema:** El TPO modela una subasta con un catalogo de multiples items; cada item se cierra individualmente (cierre de puja por pieza). En confirm-payment, tras vender UN item se llama closeAuction(io, pending.subastaId) que pone subastas.estado='cerrada' y expulsa a todos. Lo mismo ocurre en item-payment-defaulted. Es decir, vender (o impagar) la primera pieza cierra toda la subasta, dejando el resto del catalogo sin subastar. Contradice el modelo de catalogo multi-item.
- **Fix propuesto:** No cerrar la subasta al vender/impagar un item. Tras finalizar un item, avanzar al siguiente item no subastado (set-active-item / active-item-changed) y solo cerrar la subasta cuando todos los items del catalogo esten subastado='si' o por accion explicita del subastador.

### [BSEC-02] Verificador hardcodeado a 1 y auto-aprobacion (admitido='si') sin verificacion externa
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** security · **Dominio:** Seguridad / Autenticacion
- **Ubicacion:** `server/src/controllers/authController.ts:56-73`
- **Requisito TPO:** Verificacion/admision de clientes por empleado
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** En registerStep1 se inserta el cliente con admitido='si' y verificador=1 fijo (con un TODO 'asignar verificador real'). El usuario queda auto-aprobado al pasar solo validaciones de formato de entrada, sin intervencion de un empleado verificador. El campo verificador es FK a empleados; si el empleado 1 no existe la insercion falla, y si existe se le atribuye falsamente la verificacion de TODOS los registros. Esto elude el requisito de verificacion/admision de clientes. (Es en parte una simplificacion academica al no haber panel admin de verificacion, pero igual reportada: deberia quedar 'pendiente' hasta aprobacion real). El mismo patron verificador=1 se repite al crear duenios en el socket (auctionHandler.ts:759-760).
- **Fix propuesto:** Insertar admitido='no' (pendiente) y verificador NULL/segun proceso de aprobacion; habilitar al cliente solo tras verificacion de un empleado. Si se mantiene la simplificacion academica, documentarla explicitamente y al menos validar que el empleado verificador exista, evitando atribuir verificaciones falsas a empleado 1.

### [BSEC-04] Sin rotacion de refresh token, sin revocacion ni logout (replay 7 dias)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** security · **Dominio:** Seguridad / Autenticacion
- **Ubicacion:** `server/src/controllers/authController.ts:246-301; routes/auth.ts:42-49`
- **Requisito TPO:** Manejo de sesion / cierre de sesion
- **Problema:** El endpoint /auth/refresh valida el refresh token contra sesiones (activo='si') y emite un nuevo accessToken, pero NO rota el refresh token (devuelve solo accessToken y deja el mismo refreshToken valido) y NO existe endpoint de logout ni ninguna sentencia que ponga sesiones.activo='no' o borre la sesion (confirmado: no hay UPDATE/DELETE sobre sesiones en todo src). Consecuencias: (1) un refresh token robado es reutilizable durante 7 dias sin posibilidad de revocarlo; (2) no se puede cerrar sesion ni invalidar sesiones tras cambio de clave/bloqueo; (3) la columna 'activo' de sesiones existe en el schema pero nunca se usa para revocar. Ademas no se detecta reuso (no hay rotacion ni invalidacion de la familia de tokens ante reuso).
- **Fix propuesto:** Implementar rotacion: en /refresh marcar la sesion vieja activo='no' (o borrarla) y crear una nueva fila con un refresh token nuevo, devolviendolo. Agregar POST /auth/logout que ponga activo='no' para el refreshToken recibido. Invalidar sesiones del cliente al bloquear cuenta o cambiar clave. Opcional: detectar reuso de token revocado e invalidar todas las sesiones del cliente.

### [BLOG-01] place-bid no es atomico: race condition permite pujas concurrentes invalidas (viola req 26)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:456-540`
- **Requisito TPO:** req 26 / Registro de Datos (lineas 143-145 TPO)
- **Problema:** El handler lee la mejor puja (SELECT TOP 1 ... ORDER BY importe DESC) y luego inserta la nueva puja en operaciones separadas, sin transaccion ni lock de fila. Dos pujas que llegan casi simultaneas leen el mismo currentBest, ambas pasan la validacion de minimo/maximo y ambas se insertan, quedando registradas dos ofertas validas sobre el mismo valor base. El TPO (req 26 / Registro de Datos) exige que NO se permita otra puja hasta confirmar la anterior; aca el servidor no serializa las pujas por item. El callback 'success' se emite por puja sin garantizar orden ni exclusion.
- **Fix propuesto:** Envolver lectura-del-mejor-y-insert en una transaccion con bloqueo: usar un sql.Transaction y SELECT TOP 1 importe FROM pujos WITH (UPDLOCK, HOLDLOCK) WHERE item=@item, validar limites dentro de la transaccion, insertar y commitear. Alternativamente serializar por item con un lock en memoria (Map<itemId, Promise>) que encadene los place-bid del mismo item.

### [BLOG-04] Impago de pago cierra TODA la subasta y pierde los items restantes
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:717-737`
- **Requisito TPO:** req 22 (lineas 130-133 TPO)
- **Problema:** Cuando el ganador no tiene fondos en confirm-payment, ademas de aplicar la multa correctamente (10%, 72hs) y marcar el item como subastado='si', se llama closeAuction(io, pending.subastaId) que ejecuta UPDATE subastas SET estado='cerrada' y echa a todos los sockets. Eso cierra la subasta completa por el impago de UN item, dejando sin subastar los demas items del catalogo. El TPO no indica que un impago deba terminar toda la subasta; deberia cerrarse/saltarse solo ese item y continuar con el siguiente.
- **Fix propuesto:** No llamar closeAuction en el camino de impago. Cerrar/marcar solo el item (ya se hace con subastado='si'), limpiar pendingPayments y, si quedan items sin subastar, avanzar activeItems al siguiente y reprogramar timers; cerrar la subasta solo cuando todos los items quedaron subastados.

### [BLOG-05] El endpoint REST placeBid omite controles del socket (multas, conexion unica, lock, timers) y duplica la logica
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** security · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/controllers/subastasController.ts:8-186`
- **Requisito TPO:** req 22 (bloqueo por multa), req 137 (una subasta a la vez)
- **Problema:** placeBid (POST /subastas/:id/bid, wired en routes/subastas.ts:29) replica la validacion de pujas pero OMITE varios controles que si estan en el socket: (1) no verifica multas impagas (en socket se rechaza con 'Tiene multas impagas'), permitiendo a un usuario multado pujar via REST y eludir el bloqueo del req 22; (2) no verifica userConnections (req 137: un usuario no puede estar en mas de una subasta a la vez); (3) no reinicia/gestiona los timers de cierre por inactividad, por lo que una puja por REST no extiende el cierre y puede perderse el ganador; (4) no aplica ninguna serializacion (mismo race que BLOG-01). La duplicacion garantiza divergencia futura.
- **Fix propuesto:** Agregar al REST el chequeo de multas impagas y, si se mantiene el endpoint, refactorizar la validacion de puja a una funcion compartida usada por socket y REST. Idealmente que el REST delegue/emita el mismo flujo del socket incluyendo el reseteo de timers, o eliminar el endpoint si la puja es exclusivamente por socket.

### [DB-06] Falta de indice en clientes.email (columna de login, lookup en cada autenticacion)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/unified-migrations.sql:198`
- **Problema:** `clientes.email` se agrega como columna NULL (L198) sin indice ni constraint UNIQUE. El login hace `WHERE c.email = @email` (authController.ts:165) en cada autenticacion, forzando un table scan de clientes. Ademas la falta de UNIQUE permite registrar dos clientes con el mismo email, rompiendo la unicidad de identidad de usuario. No hay ningun CREATE INDEX en todo el proyecto (grep confirmo 0).
- **Fix propuesto:** Agregar `CREATE UNIQUE INDEX ux_clientes_email ON clientes(email) WHERE email IS NOT NULL;` (indice filtrado para tolerar NULLs en filas legacy). Asi se acelera el login y se garantiza unicidad de email.

### [A5-01] Sin reconexion automatica visible: la UI queda congelada al caer la conexion
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:83-197, 358`
- **Requisito TPO:** Subasta en tiempo real (seguimiento de pujas en vivo)
- **Problema:** El componente nunca registra handlers para los eventos 'disconnect' ni 'connect' del socket. El estado 'connected' solo pasa a true una vez dentro del callback de 'join-auction' (linea 93) y solo vuelve a false en 'auction-closed' (linea 177). Si el socket se cae (perdida de red, suspension del dispositivo), socket.io-client por defecto intentara reconectar, pero: (1) el indicador 'live' sigue verde (linea 358 depende solo de 'connected'), dando feedback falso al usuario; (2) al reconectar, el cliente NO vuelve a emitir 'join-auction', por lo que el servidor no lo re-suscribe a la room ni le reenvia el estado actual (mejor oferta, item activo, canBid). El resultado es una UI congelada que parece viva pero ya no recibe pujas ni cambios de item. En una subasta en vivo esto rompe el requisito core de seguimiento en tiempo real.
- **Fix propuesto:** Registrar socket.on('disconnect', () => { if (mounted) { setConnected(false); setBidReason('Conexion perdida, reconectando...'); } }) y socket.on('connect', () => { if (mounted) { setConnected(true); socket.emit('join-auction', subastaId, (resp) => { /* re-hidratar estado: canBid, bestBid, currentItem */ }); } }). Asi al reconectar se re-suscribe a la room y re-sincroniza el estado. Mostrar un banner de estado de conexion mientras connected === false.

---

## MEDIUM (30)

### [BUG-01] Mismatch frontend/backend en upgrade de poliza: el medio elegido se ignora
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** correctness
- **Ubicacion:** `server/src/controllers/ventaController.ts:554-575`
- **Requisito TPO:** Req 199 (aumentar valor de la poliza pagando la diferencia)
- **Problema:** El frontend (vender.tsx:236) envia el medio seleccionado por el usuario como body { medioDePagoId } al endpoint POST /venta/solicitudes/:id/poliza/upgrade. El backend upgradePolizaSolicitud NO lee req.body en absoluto: ignora el medio elegido y selecciona automaticamente el primer medio verificado en la moneda con saldo suficiente (ORDER BY montoDisponible DESC). El usuario puede terminar pagando con un medio distinto del que selecciono en el modal, sin enterarse.
- **Fix propuesto:** Leer medioDePagoId (o medioPagoId, unificar el nombre con el resto del codigo que usa medioPagoId) del body, validar que pertenece al usuario, esta verificado/activo, en la moneda correcta y con saldo suficiente, y debitar de ESE medio. Agregar validacion en la ruta.

### [BSEC-06] Sin validacion de variables de entorno al arrancar; secretos faltantes provocan 500 en runtime
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** security · **Dominio:** Seguridad / Configuracion
- **Ubicacion:** `server/src/index.ts:20-83; auth.ts:27; authController.ts:206-211,279-283`
- **Problema:** No hay validacion de env al boot. login/refresh chequean JWT_SECRET/JWT_REFRESH_SECRET pero recien en el handler: si faltan lanzan Error que cae al catch y responde 500 generico (no crash limpio ni aviso al iniciar). Peor: authGuard (auth.ts:27) y el middleware de socket (auctionHandler.ts:228) hacen jwt.verify(token, process.env.JWT_SECRET as string); con el secret undefined, jwt.verify falla y devuelve 401 'Token invalido', enmascarando una mala configuracion como error de credenciales. El servidor levanta igual con secretos vacios, dando una falsa sensacion de funcionamiento. Nota: el .env real esta correctamente en .gitignore y los secretos son valores aleatorios base64 (no defaults debiles), por lo que el problema es la ausencia de validacion, no secretos hardcodeados en el repo.
- **Fix propuesto:** Validar al inicio (antes de server.listen) que JWT_SECRET, JWT_REFRESH_SECRET y las credenciales de DB existan y tengan longitud minima; abortar el proceso con mensaje claro si faltan. Centralizar lectura de env en un modulo config tipado.

### [BSEC-07] Sin error handler global ni handler 404 en Express
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** security · **Dominio:** Seguridad / Manejo de errores
- **Ubicacion:** `server/src/index.ts:60-76`
- **Problema:** index.ts monta rutas pero no registra ningun middleware de manejo de errores global (firma (err, req, res, next)) ni un handler 404. Los controladores capturan sus propios try/catch, pero cualquier error sincrono/async no capturado (p.ej. en middlewares, body parser con JSON malformado, o rutas futuras) caera al handler por defecto de Express, que en desarrollo expone el stack trace al cliente (fuga de informacion). Tampoco hay respuesta uniforme { success:false } para rutas inexistentes.
- **Fix propuesto:** Agregar al final de la cadena un handler 404 que devuelva { success:false, error:'No encontrado' } y un error handler global (err,req,res,next) que loguee el error y responda 500 con mensaje generico, evitando filtrar stack traces.

### [BSEC-08] El estado de cuenta no se reverifica en la sesion de socket; token sigue valido tras bloqueo/multa
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** security · **Dominio:** Seguridad / Autorizacion Socket
- **Ubicacion:** `server/src/socket/auctionHandler.ts:222-238`
- **Requisito TPO:** Bloqueo de cuenta / suspension por multa
- **Problema:** El middleware de autenticacion de socket solo verifica la firma del JWT y confia ciegamente en el payload (id, email, categoria, admitido) embebido al momento del login. No reconsulta la DB para validar que la cuenta siga activa (personas.estado), admitida, sin multas derivadas a justicia, ni que la categoria siga siendo la actual. Un usuario bloqueado o con multa derivada a justicia despues de loguearse mantiene su accessToken (1h) y puede conectarse al socket. Ademas la categoria viaja en el token: si cambia en DB, el privilegio efectivo en el socket no se actualiza hasta re-loguear. (Las multas pagada='no' si se chequean en join/place-bid, pero estado de cuenta y derivadaJusticia no.)
- **Fix propuesto:** En el connect del socket (o al menos en join-auction/place-bid) reconsultar personas.estado y multas derivadaJusticia del cliente y rechazar si esta inactivo/suspendido; idealmente leer categoria desde DB en vez de confiar en el token. Reducir vida del access token y/o permitir revocacion (ver BSEC-04).

### [BLOG-02] pujos no tiene columna temporal; el orden de las pujas se infiere del IDENTITY y el ganador se elige sin desempate temporal
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:98-116`
- **Requisito TPO:** req Registro de Datos (linea 143 TPO)
- **Problema:** El TPO (lineas 143) exige guardar todos los pujes 'respetando el orden'. La tabla pujos (unified-migrations.sql:155-164) solo tiene identificador, asistente, item, importe, ganador: NO hay fechaPuja/timestamp. La seleccion del ganador en finalizeItemForPayment ordena solo por 'ORDER BY p.importe DESC' sin desempate, por lo que ante dos pujas del mismo importe el ganador es indeterminista (lo decide el plan de ejecucion de SQL Server, no el orden temporal). Ademas getCurrentBestBid usa 'ORDER BY p.importe DESC, p.identificador DESC' (desempate por id mayor) pero finalizeItemForPayment no lo hace, generando inconsistencia entre el ganador mostrado al reabrir y el ganador final.
- **Fix propuesto:** Agregar columna fechaPuja DATETIME2 DEFAULT SYSUTCDATETIME() a pujos via migracion. Unificar el ORDER BY del ganador y de getCurrentBestBid a 'ORDER BY p.importe DESC, p.fechaPuja ASC, p.identificador ASC' (gana el mayor importe; ante empate, el primero en el tiempo).

### [DB-04] run-migrations.js referencia archivos de migracion inexistentes (src/migrations/001..003)
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/run-migrations.js:22-26`
- **Problema:** `run-migrations.js` itera sobre `src/migrations/001_fix_typos.sql`, `002_nuevas_columnas.sql`, `003_nuevas_tablas.sql`, pero esos archivos NO existen (el unico .sql en server/ es `unified-migrations.sql` y `migrations/004_...`; no hay carpeta `src/migrations`). Ejecutar este script falla en `fs.readFileSync` con ENOENT. Conviven dos runners (`run-migrations.js` roto y `run-unified-migrations.js` funcional) y la doc del CLAUDE.md menciona aun otro (`run-migrations-v2.js`) tambien inexistente. Esto confunde cual es el flujo oficial y deja codigo muerto que puede correrse por error.
- **Fix propuesto:** Eliminar `run-migrations.js` (o repararlo apuntando a archivos reales) y dejar `run-unified-migrations.js` como unico runner. Actualizar CLAUDE.md para que el comando documentado (`node run-migrations-v2.js`) coincida con el script real.

### [DB-07] Falta de indice en pujos.item (consulta en hot-path de cada puja en la subasta en vivo)
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/unified-migrations.sql:155-164`
- **Problema:** La tabla `pujos` (L155-164) solo tiene PK en `identificador` y FKs sin indice de soporte. El handler de la subasta en tiempo real consulta `pujos WHERE item = @item` repetidamente y ordena por importe en el camino critico de cada puja: `SELECT TOP 1 importe FROM pujos WHERE item = @item ORDER BY importe DESC` (auctionHandler.ts:459), ademas de COUNT y agregaciones (L114, L197, L318, L342). Con varias subastas activas y muchas pujas, cada operacion es un table scan + sort. Es el flujo de mayor frecuencia de la app y el mas sensible a latencia.
- **Fix propuesto:** Agregar `CREATE INDEX ix_pujos_item_importe ON pujos(item, importe DESC) INCLUDE (asistente, ganador);`. El indice cubre tanto el WHERE como el ORDER BY del TOP 1, eliminando el sort en el hot-path.

### [A5-02] Configuracion de socket sin reconexion explicita ni timeout de ack
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/src/services/socket.ts:19-28`
- **Problema:** La instancia de socket.io se crea sin opciones de reconexion explicitas (reconnection, reconnectionAttempts, reconnectionDelay) ni ackTimeout. Aunque socket.io-client reconecta por defecto, la promesa de connectSocket solo resuelve en el primer 'connect' y rechaza en el primer 'connect_error', sin remover esos listeners (L25-26): cada reconexion dispara de nuevo el handler 'connect' registrado en la promesa, que llama resolve() sobre una promesa ya resuelta (no-op, pero deja listeners colgados acumulandose). Ademas, sin ackTimeout, los emit con callback de place-bid/confirm-payment pueden no responder nunca si el server esta caido, dejando 'sending' en true para siempre (boton bloqueado permanentemente).
- **Fix propuesto:** Pasar opciones: io(SOCKET_URL, { auth: { token }, transports: [...], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, timeout: 10000 }). En la promesa usar socket.once('connect', ...) y socket.once('connect_error', ...) (no .on) para no acumular listeners. Para los emit con callback usar el ack timeout de socket.io v4 (socket.timeout(8000).emit('place-bid', payload, (err, resp) => {...})) o un setTimeout manual que resetee 'sending'.

### [A5-05] Listeners del socket nunca se remueven con socket.off al desmontar
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:112-181, 189-196`
- **Problema:** En el cleanup del useEffect (L189-196) se emite 'leave-auction' y se llama disconnectSocket(), pero nunca se hace socket.off() de los ~8 listeners registrados (new-bid, active-item-changed, item-close-scheduled, item-sold, item-no-bids, you-won, item-payment-cancelled, auction-closed). Como connectSocket() reutiliza la misma instancia singleton si ya esta conectada (socket?.connected, socket.ts L15), si el componente se monta/desmonta varias veces (navegacion, React StrictMode dev double-invoke) o si disconnectSocket no llega a destruir la instancia antes de un remonte, los listeners se acumulan y los handlers de un componente desmontado siguen vivos. El guard 'mounted' evita setState tras desmontar, pero no evita la fuga de listeners ni ejecuciones duplicadas (ej: dos Alert por un solo item-sold).
- **Fix propuesto:** Guardar referencias a los handlers y en el cleanup llamar socket.off('new-bid', handler) para cada uno, o socket.removeAllListeners() de los eventos propios antes de disconnectSocket(). Alternativamente registrar todos los listeners en un objeto y recorrerlo para .on/.off simetrico.

### [A5-07] El boton Pujar puede quedar bloqueado permanentemente si el ack no llega (req 26)
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:260-275, 433-439`
- **Requisito TPO:** Req 26 (bloqueo de puja hasta confirmar anterior)
- **Problema:** El requisito 26 (bloquear el boton de puja hasta confirmar la anterior) esta parcialmente cubierto: setSending(true) (L260) y loading={sending} en el Button (L437) deshabilitan el boton mientras se espera el ack, y se resetea en el callback (L268). Sin embargo, sending solo se resetea dentro del callback de place-bid; si el ack del servidor nunca llega (server caido, socket desconectado tras el emit, paquete perdido) el boton queda en loading para siempre y el usuario no puede volver a pujar ni recibe error. No hay timeout que libere el estado. Tambien: el emit no verifica socket.connected antes de enviar (solo getSocket() != null), por lo que puede emitir hacia un socket desconectado y nunca recibir respuesta.
- **Fix propuesto:** Usar ack con timeout: socket.timeout(8000).emit('place-bid', payload, (err, response) => { setSending(false); if (err) { Alert.alert('Error', 'No se recibio respuesta del servidor'); return; } ... }). Verificar if (!socket?.connected) { setSending(false); Alert.alert('Sin conexion', 'Reconectando...'); return; } antes de emitir.

### [A6-API-01] Axios instance sin timeout: requests pueden colgar indefinidamente
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-services
- **Ubicacion:** `app/src/services/api.ts:48`
- **Problema:** El cliente axios se crea sin la opcion timeout. En un emulador o red movil, si el backend no responde (ej: el servidor esta caido o el resolveApiUrl apunto a un host equivocado), la promesa nunca se rechaza. Los estados loading (login, vender, pagar, etc.) quedan en true para siempre y el usuario ve spinners infinitos sin mensaje de error. Es un bug funcional real, no estilo.
- **Fix propuesto:** Agregar timeout y manejar timeouts: axios.create({ baseURL: API_URL, timeout: 15000 }). En los interceptores de respuesta, detectar error.code === 'ECONNABORTED' y mapearlo a un mensaje 'La conexion tardo demasiado, reintenta'.

### [A6-THEME-01] Colores hex hardcodeados en el layout de tabs que duplican exactamente tokens de src/theme/colors
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(tabs)/_layout.tsx:8-15`
- **Problema:** El TabLayout escribe valores hex literales que coinciden 1:1 con tokens existentes: '#C9A84C' = colors.auctionGold, '#9CA3AF' = colors.textMuted, '#FAF8F5' = colors.ivory, '#E5E1DB' = colors.border, '#1A1D23' = colors.textPrimary. El CLAUDE.md de mobile-ui exige 'Use theme tokens. No hardcoded colors/sizes'. A diferencia del (auth)/_layout.tsx que SI importa colors, este archivo ni siquiera importa el theme. Riesgo de drift visual si se cambia la paleta.
- **Fix propuesto:** import { colors } from '../../src/theme'; y reemplazar: tabBarActiveTintColor: colors.auctionGold, tabBarInactiveTintColor: colors.textMuted, backgroundColor: colors.ivory, borderTopColor: colors.border, headerTintColor: colors.textPrimary.

### [REQ-08] Cada solicitud de venta crea su propia subasta nueva sin rematador ni agrupacion (coleccion)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/controllers/ventaController.ts:729-787`
- **Requisito TPO:** Req 7 (subasta con rematador), Coleccion, Req 18
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** Al aceptar una solicitud, responderSolicitud crea SIEMPRE una subasta nueva (estado 'abierta') con un unico item y sin asignar subastador (queda NULL). El TPO indica que la subasta tiene un rematador asignado y un catalogo (plural de objetos); ademas, si los articulos de un usuario son numerosos la empresa puede agruparlos en una 'coleccion' con el nombre del usuario. Aqui no hay asignacion de rematador, ni agrupacion de varias solicitudes/articulos del mismo usuario en una coleccion: cada solicitud = una subasta de un item.
- **Fix propuesto:** Asignar un subastador (subastadores) a la subasta creada y, al menos opcionalmente, permitir agrupar items en un mismo catalogo/subasta (coleccion) cuando provienen del mismo cliente. Documentar la simplificacion si se mantiene 1 item por subasta.

### [REQ-10] La confirmacion de puja se valida pero el bloqueo 'no permitir otra puja hasta confirmar' no esta garantizado
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** requirements
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:260-275`
- **Requisito TPO:** Req 26 (no permitir otra puja hasta recibir confirmacion del sistema)
- **Problema:** El TPO exige que tras pujar la app no permita otra puja hasta recibir confirmacion del sistema. El handler usa el callback de Socket.IO (confirmacion) y maneja setSending, pero el boton Pujar no se deshabilita por 'sending': solo muestra loading. handleBid no chequea 'if (sending) return', por lo que el usuario puede emitir multiples place-bid antes de recibir el callback del primero. El backend no usa transaccion/lock por item: dos place-bid concurrentes leen el mismo currentBest y ambos pueden insertarse. La intencion existe (callback) pero la garantia de exclusion no.
- **Fix propuesto:** Frontend: agregar guard 'if (sending) return;' al inicio de handleBid y/o disabled={sending} en el boton. Backend: serializar las pujas por item (transaccion con bloqueo o validacion atomica del mejor importe en el INSERT) para evitar carreras.

### [BSEC-03] Fotos de documento (frente/dorso) se exigen pero nunca se guardan
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** low · **Categoria:** security · **Dominio:** Seguridad / Autenticacion
- **Ubicacion:** `server/src/controllers/authController.ts:11, 75 (auth.ts:16-17)`
- **Requisito TPO:** Registro etapa 1 con documento (frente y dorso)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El endpoint register/step1 valida fotoFrente y fotoDorso como requeridas (routes/auth.ts:16-17) y las desestructura, pero el codigo nunca las persiste: hay solo un comentario 'TODO: Guardar fotos documento en Cloudinary'. La verificacion de identidad por documento es imposible sin las imagenes; ademas se aceptan payloads de hasta 25mb (index.ts:46) que se descartan. Rompe el requisito de captura de documento para verificacion y desperdicia ancho de banda/memoria.
- **Fix propuesto:** Persistir fotoFrente/fotoDorso (Cloudinary o columna varbinary/blob ligada a personas) antes de responder 201, o no exigirlas en el validator si es simplificacion academica. Documentar la decision.

### [BLOG-06] Garantia por cheque (req 21) no se modela como tope acumulado: montoCheque es estatico y nunca se valida contra el total de compras
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:658-668`
- **Requisito TPO:** req 21 (linea 129 TPO)
- **Problema:** El TPO (req 21, linea 129) exige que con garantia de cheque las compras no superen dicho monto, pero mientras alcance puede participar en cuantas subastas quiera. La implementacion solo compara montoDisponible < total en confirm-payment (auctionHandler) y decrementa montoDisponible. montoCheque queda fijo (mediosPagoController.ts:38) y nunca se usa para validar; la semantica 'compras acumuladas <= monto del cheque' queda implicita en montoDisponible y no es explicita ni auditable. Si montoDisponible se recarga via updateSaldoMedioPago (mediosPagoController.ts:115) un cheque podria 'recargarse', violando que el tope es el valor del cheque certificado y entregado antes de la subasta.
- **Fix propuesto:** Para tipo='cheque_certificado', validar contra montoCheque como tope rigido (suma de compras pagadas con ese cheque <= montoCheque) o impedir recargas (updateSaldoMedioPago) sobre cheques. Documentar explicitamente que montoDisponible representa el saldo remanente del cheque.

### [DB-02] Idempotencia fragil: CREATE TABLE / ALTER ADD sin guardas, dependen de tragar errores por substring del mensaje
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** low · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/unified-migrations.sql:10-302`
- **Problema:** Los CREATE TABLE (paises, personas, ... lineas 10-302) y los ALTER TABLE ADD de PHASE 2/3 (lineas 186-199) NO tienen guardas IF NOT EXISTS / IF COL_LENGTH. La 'idempotencia' depende enteramente de que `run-unified-migrations.js` ignore errores cuyo mensaje contenga la substring 'already'. Esto es fragil: (a) si SQL Server esta en espanol u otro locale, el mensaje no contiene 'already' y el runner aborta; (b) `ALTER TABLE personas DROP CONSTRAINT chkEstado` (linea 186) falla con 'is not a constraint' (no 'already') en una segunda corrida sobre base ya migrada; (c) los ALTER ADD moneda/email/claveHash (197-199) tiran 'Column names ... must be unique' sin 'already'. Contrasta con PHASE 5 (lineas 306-332) que SI usa `IF COL_LENGTH(...) IS NULL`, demostrando que el patron correcto se conocia pero no se aplico consistentemente.
- **Fix propuesto:** Envolver cada CREATE TABLE con `IF OBJECT_ID('tabla','U') IS NULL`, cada ADD columna con `IF COL_LENGTH('tabla','col') IS NULL`, cada DROP CONSTRAINT con `IF OBJECT_ID('chkEstado','C') IS NOT NULL`, y cada ADD CONSTRAINT FK con `IF OBJECT_ID('fk_...','F') IS NULL`. Asi la idempotencia es a nivel SQL y no depende del idioma del mensaje de error.

### [DB-09] Falta de indice y de unicidad en asistentes(cliente, subasta) / (subasta, numeroPostor)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** low · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/unified-migrations.sql:145-153`
- **Problema:** `asistentes` (L145-153) no tiene indice sobre (cliente, subasta) ni sobre (subasta, numeroPostor). El codigo consulta `WHERE cliente = @cliente AND subasta = @subasta` para evitar duplicar al postor (auctionHandler.ts:509, subastasController.ts), hace `MAX(numeroPostor) WHERE subasta=@subasta` (L517), y estadisticas con `COUNT(DISTINCT subasta) WHERE cliente=@cliente` (estadisticasController.ts:14). Todos table scans. Ademas no hay constraint UNIQUE(cliente, subasta), por lo que un cliente puede quedar registrado dos veces en la misma subasta si la verificacion previa y el INSERT corren concurrentemente.
- **Fix propuesto:** Agregar `CREATE UNIQUE INDEX ux_asistentes_cliente_subasta ON asistentes(cliente, subasta);` (acelera lookup y garantiza no-duplicado) y `CREATE INDEX ix_asistentes_subasta_postor ON asistentes(subasta, numeroPostor);` para el MAX.

### [DB-10] DDL en runtime: ensureVentaSchema() crea tablas y columnas en la primera request en vez de en migracion
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/src/controllers/ventaController.ts:116-212`
- **Problema:** `ensureVentaSchema()` ejecuta DDL (ALTER TABLE ADD de 6 columnas en solicitudesVenta y 4 en productos, y CREATE TABLE de solicitudFotos, solicitudArticulos, solicitudArticuloFotos, productoArticulos, productoArticuloFotos) en runtime, disparado por la primera request a createSolicitud/getSolicitudes (llamado en L306, 412, 447, 473, 523, 620). Problemas: (1) el schema 'real' vive fuera de las migraciones, asi que `unified-migrations.sql` NO refleja el estado verdadero de la base — quien lea solo el SQL no sabe que existen esas tablas; (2) requiere que el usuario de la app (sa) tenga permisos DDL en produccion, lo cual es un riesgo de seguridad; (3) la primera request paga latencia de ALTER/CREATE y, ante fallos de concurrencia o permisos, rompe endpoints de negocio en vez de fallar el deploy; (4) el guard `schemaEnsurePromise` es solo en-memoria por proceso, no protege contra dos instancias del servidor corriendo el DDL a la vez.
- **Fix propuesto:** Mover todo el DDL de ensureVentaSchema a `unified-migrations.sql` (o una migracion versionada nueva) con guardas IF COL_LENGTH / IF OBJECT_ID. En runtime, eliminar la funcion y asumir que el schema ya existe. Si se quiere un check, que sea de solo-lectura (verifica y loguea/aborta el arranque), nunca DDL en el path de requests.

### [A5-03] Deteccion fragil de multa por substring includes('multa aplicada')
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:290-294`
- **Requisito TPO:** Aplicacion de multa por incumplimiento de pago
- **Problema:** El manejo del rechazo de pago detecta el caso de multa parseando el texto del error con response.error.toLowerCase().includes('multa aplicada'). Esto es fragil: si el backend cambia el wording, traduce, agrega puntuacion, o reordena el mensaje, la rama de cierre del modal deja de ejecutarse y el modal queda abierto en un estado inconsistente. Acoplar logica de negocio (se aplico multa -> cerrar modal de pago) a una cadena humana es propenso a romperse. Ademas, tras cerrar el modal igual se dispara Alert.alert('Pago rechazado', response.error) (L294 fuera del if), por lo que el usuario que recibio una multa ve un mensaje generico de 'pago rechazado' en vez de un mensaje claro sobre la multa.
- **Fix propuesto:** Que el backend devuelva un codigo estructurado, ej response.code === 'MULTA_APLICADA' o response.data?.multaAplicada === true dentro de { success, data, error }. En el cliente: if (response.data?.multaAplicada) { setShowPaymentModal(false); setWonItem(null); Alert.alert('Multa aplicada', 'Se aplico una multa por no completar el pago.'); return; } y dejar el Alert generico solo para los demas casos (usar return para no mostrar dos alerts).

### [A5-08] Feedback de estado de conexion insuficiente (solo un punto de color)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:356-362, 441-445`
- **Problema:** El unico feedback de conexion es un punto de 8px que cambia de color segun 'connected' (L358). No hay banner, texto ni overlay que informe 'Conectando...', 'Conexion perdida' o 'Reconectando...'. Dado A5-01 (connected nunca se pone en false al caer), el usuario no tiene forma de saber que dejo de recibir actualizaciones en una subasta en vivo, donde perder pujas tiene consecuencias economicas. La barra de puja tampoco se oculta ni avisa cuando no hay conexion.
- **Fix propuesto:** Agregar un banner condicional cuando !connected: <View style={styles.connBanner}><Text>Conexion perdida. Reconectando...</Text></View>, y un texto junto al punto (VIVO / SIN CONEXION). Deshabilitar/ocultar la barra de puja mientras !connected.

### [A6-API-03] Refresh asume forma data.data.accessToken sin validar y silencia el error sin notificar al store
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** frontend-services
- **Ubicacion:** `app/src/services/api.ts:72-83`
- **Problema:** Tras el refresh se accede a data.data.accessToken sin validar que exista; si el backend cambia el contrato o devuelve { success:false }, newToken es undefined y se guarda 'Bearer undefined'. Ademas, en el catch se borran los tokens pero NO se notifica al authStore (set isAuthenticated:false). El comentario dice 'El store detectara que no hay token' pero el store solo revisa el token en loadUser() al arrancar, no reactivamente: la pantalla actual sigue creyendo que esta autenticada hasta el proximo arranque. UX rota: el usuario queda en una pantalla logueada que devuelve errores en cada accion.
- **Fix propuesto:** Validar if (!data?.data?.accessToken) throw new Error('refresh sin token'). En el catch, invocar un callback del authStore (ej: useAuthStore.getState().logout() o un onAuthExpired) para limpiar estado y forzar router.replace('/(auth)/login').

### [A6-VENDER-03] Fotos base64 con quality 0.45 enviadas en el body JSON: payload pesado y riesgo de fallo de subida
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** performance · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(tabs)/vender.tsx:111-130, 168-171`
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** pickArticuloPhotos pide base64:true con quality 0.45 y permite hasta 12 fotos por articulo; handleSubmit exige minimo 6 fotos en total. Cada foto base64 (incluso comprimida) puede pesar cientos de KB; el POST /venta/solicitudes manda articulos[].fotos[] como strings base64 dentro del JSON. Multiples articulos x varias fotos puede generar un body de varios MB en una sola request sin timeout (ver A6-API-01), lo que en red movil/emulador suele cortar o tardar mucho. base64 ademas infla ~33% sobre el binario. quality:0.45 es un valor magico sin constante ni comentario.
- **Fix propuesto:** Subir las imagenes via multipart/form-data (FormData con el uri del asset) en vez de base64 en JSON, idealmente a Cloudinary (ya mencionado en CLAUDE.md) y mandar solo URLs. Si se mantiene base64, extraer IMAGE_QUALITY = 0.45 a constante, agregar timeout mas alto para este endpoint y validar tamano maximo antes de enviar.

### [A6-INDEX-01] Polling cada 8s en pantalla de subastas sin pausa: doble fetch inicial y trabajo redundante
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** performance · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(tabs)/index.tsx:47-62`
- **Problema:** Hay un useEffect que llama fetchSubastas y, ademas, un useFocusEffect que vuelve a llamar fetchSubastas inmediatamente y arma setInterval cada 8000ms. Al montar/enfocar se dispara fetch dos veces casi simultaneo. El polling no se detiene cuando la pantalla pierde foco mediante condicion (si bien useFocusEffect limpia el interval al desenfocar, no hay debounce ni respeto del AppState en background) y no se cancela el request en vuelo previo, por lo que respuestas tardias pueden pisar estado mas nuevo. Cada tick recarga GET /subastas?limit=50 trayendo posiblemente fotos base64 de items, costo no trivial en datos. No hay backoff si el server falla (el catch silencia y reintenta a los 8s indefinidamente).
- **Fix propuesto:** Eliminar el useEffect redundante (useFocusEffect ya cubre el primer fetch). Cancelar el request anterior con AbortController/axios CancelToken en cada tick. Pausar el polling con AppState cuando la app va a background. Considerar Socket.IO (ya en el stack) en vez de polling para actualizaciones de subastas en vivo.

### [REQ-11] Aprobacion automatica en etapa 1 sin verificacion real (admitido='si')
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/controllers/authController.ts:56-61, 82`
- **Requisito TPO:** Req 1/3 (datos verificados por la empresa mediante investigacion externa)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** registerStep1 marca admitido='si' inmediatamente al insertar el cliente, devolviendo autoAprobado:true. No hay paso de verificacion externa real (no hay panel admin), por lo que cualquiera que pase las validaciones de entrada queda aprobado al instante y puede completar la etapa 2. Es una simplificacion academica explicita (no se desarrolla el backoffice de la empresa), pero conviene marcarla porque elimina el gate de 'investigacion externa' del TPO.
- **Fix propuesto:** Dejar documentado el auto-aprobado como simplificacion, o introducir un estado intermedio (admitido='no'/'pendiente') que se libere por un endpoint admin o un setTimeout, replicando el patron de auto-aceptacion de solicitudes de venta para hacerlo mas fiel al flujo.

### [BSEC-05] Sin lockout/anti fuerza bruta por cuenta; rate-limit solo por IP y generoso
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** security · **Dominio:** Seguridad / Autenticacion
- **Ubicacion:** `server/src/index.ts:33-40, 61`
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** La unica proteccion ante fuerza bruta de login es authLimiter (15 intentos / 15 min) aplicado a TODO /api/auth por IP. No hay bloqueo por cuenta ni conteo de intentos fallidos por email, por lo que un atacante distribuido (multiples IP) o uno solo dentro del cupo puede iterar contrasenas; ademas el limite de 15 cubre login, register y refresh juntos por IP. No se registran intentos fallidos ni se bloquea temporalmente la cuenta tras N fallos.
- **Fix propuesto:** Agregar lockout por cuenta (contar intentos fallidos por email y bloquear temporalmente, p.ej. 5 intentos / 15 min) ademas del limite por IP, y un limiter mas estricto y dedicado solo a /login. Registrar/auditar intentos fallidos.

### [BLOG-03] Auto-compra de la empresa (req 18) no registra venta ni cambia dueno: solo marca subastado='si'
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** high · **Categoria:** requirement-gap · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:118-128`
- **Requisito TPO:** req 18 (linea 189 TPO)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El TPO (req 18, linea 189) dice: 'Si nadie puja por un articulo, la empresa compra el mismo por el valor base al finalizar la subasta'. Cuando no hay pujas, finalizeItemForPayment solo ejecuta UPDATE itemsCatalogo SET subastado='si' y emite item-no-bids con compraEmpresa:true, pero NO inserta nada en registroDeSubasta, NO transfiere el dueno a la empresa, NO registra el importe = precio base ni la comision. La 'compra por la empresa' es puramente cosmetica (un flag en el evento), no hay rastro contable de la operacion exigida.
- **Fix propuesto:** En el caso sin pujas, leer precioBase/comision/duenio/producto del item e insertar un registroDeSubasta con cliente = id de la empresa (cliente sistema), importe = precioBase, comision correspondiente; opcionalmente actualizar productos.duenio a la empresa. Documentar el id de cliente que representa a la empresa.

### [BLOG-08] Timers de cierre por inactividad y auto-aceptacion de ventas son setTimeout en memoria: se pierden al reiniciar el servidor
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:31-32, 565-574`
- **Requisito TPO:** Cierre de Puja (linea 116-118 TPO), Inspeccion/Resultado (lineas 176-184 TPO)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El cierre del item por inactividad (LAST_BID_CLOSE_MS=15s), el auto-buy por no-puja (NO_BID_AUTO_BUY_MS=1h) y la auto-aceptacion de solicitudes de venta (ventaController.ts:234-249, AUTO_ACCEPT_DELAY_MS=30s) se implementan con setTimeout en proceso. Si el servidor se reinicia o cae mientras un timer esta pendiente, el item nunca se finaliza (queda sin ganador ni venta registrada) y la solicitud nunca pasa a 'aceptada'. Tambien quedan colgados si el proceso se reinicia entre la puja y el cierre. No hay reconstruccion de timers al arrancar.
- **Fix propuesto:** Persistir el deadline (ej. columna fechaCierreProgramado en itemsCatalogo / fechaAutoAceptacion en solicitudesVenta) y reconstruir/ejecutar los pendientes en el arranque del servidor con un job de reconciliacion, o usar un scheduler durable. Como minimo documentar la limitacion academica.

### [BLOG-11] Respuestas con fotos en base64 embebidas: payload gigante en catalogo, detalle y solicitudes
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** performance · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/controllers/subastasController.ts:341-353, 397-433`
- **Requisito TPO:** Objetos del Catalogo (lineas 67-74 TPO)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** getCatalogo, getItemDetalle (y analogamente getSubastas linea 250-256, y ventaController loadSolicitudArticulos) leen VARBINARY de fotos y las serializan a data:image/...;base64 dentro del JSON. Un item con ~6 fotos por articulo y multiples articulos genera respuestas de varios MB; getCatalogo devuelve una foto base64 por item de toda la subasta. Esto infla memoria del servidor (Buffer.toString('base64')), ancho de banda y tiempo de render en el cliente movil. No hay endpoint de imagen por separado ni cache.
- **Fix propuesto:** Servir las imagenes por un endpoint dedicado (GET /fotos/:id que devuelva el binario con Content-Type) y enviar en el JSON solo IDs/URLs. En catalogo/listados devolver una unica miniatura por URL. Esto desacopla el payload de datos del binario.

### [DB-01] No existe tabla de control de versiones de migraciones (schema_version)
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/run-unified-migrations.js:13-54`
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** No hay ninguna tabla de versionado de migraciones (schema_version / __migrations) en todo el proyecto (grep confirmo 0 coincidencias). El runner `run-unified-migrations.js` re-ejecuta TODO el archivo `unified-migrations.sql` completo cada vez, sin registrar que migraciones ya se aplicaron. No hay forma de saber en que version esta la base, ni de aplicar solo los cambios nuevos. Esto convierte el flujo de migracion en algo no determinista y dependiente de tragarse errores 'already exists'. Para un TPO academico es aceptable como simplificacion, pero es un riesgo real de integridad de schema.
- **Fix propuesto:** Crear tabla `schemaVersion(version INT PRIMARY KEY, nombre VARCHAR(250), fechaAplicada DATETIME DEFAULT GETDATE())`. Antes de cada batch/archivo, verificar `IF NOT EXISTS (SELECT 1 FROM schemaVersion WHERE version=@v)` y registrar tras aplicar. Numerar las migraciones (001, 002, ...) y aplicarlas en orden solo si no estan registradas.

---

## LOW (29)

### [BSEC-09] optionalAuth corre authGuard y responde 401 ante token invalido en rutas publicas
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** security · **Dominio:** Seguridad / Autorizacion API
- **Ubicacion:** `server/src/routes/subastas.ts:11-17, 23-26`
- **Requisito TPO:** T304/T306 catalogo e item (precio solo si autenticado)
- **Problema:** optionalAuth delega en authGuard cuando hay header Bearer. Si el token es invalido/expirado, authGuard envia res.status(401) y NO llama next(); optionalAuth retorna en ese caso (return authGuard(...)), por lo que un token MALO/vencido en una ruta 'publica' (catalogo/itemDetalle) responde 401 en vez de tratar al usuario como anonimo. Esto contradice la intencion 'no falla si no hay token': un token vencido bloquea el acceso publico al catalogo en lugar de degradar a vista anonima. No es una vulnerabilidad de acceso, pero es un fallo de robustez/UX en un control de auth.
- **Fix propuesto:** Para auth realmente opcional, no reutilizar authGuard: intentar jwt.verify dentro de un try/catch y, si falla, continuar como anonimo (next()) sin enviar 401. Asi un token vencido no bloquea el catalogo publico.

### [BSEC-10] categoryGuard confia en categoria del token sin validar que sea una categoria conocida
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** security · **Dominio:** Seguridad / Autorizacion
- **Ubicacion:** `server/src/middleware/auth.ts:35-53`
- **Problema:** categoryGuard calcula userLevel = order.indexOf(req.user.categoria) y compara userLevel < requiredLevel. Confia en el valor de categoria del token sin validar que pertenezca a la lista conocida. Si la categoria fuese NULL o un valor corrupto, indexOf devuelve -1; el comportamiento depende del requiredLevel y puede no fallar de forma cerrada en todos los casos (p.ej. si minCategory estuviera mal escrita, requiredLevel=-1 y -1<-1 es false => pasa). Conviene fallar cerrado ante categorias/niveles desconocidos.
- **Fix propuesto:** Validar explicitamente que req.user.categoria pertenezca a 'order'; si userLevel===-1 o requiredLevel===-1, denegar (403). Fallar cerrado ante categorias o niveles desconocidos.

### [BLOG-07] Estadisticas suman montos ARS+USD en un mismo total (cifras sin sentido)
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/controllers/estadisticasController.ts:82-84`
- **Requisito TPO:** Metricas y Estadisticas (lineas 147-154 TPO)
- **Problema:** getEstadisticas calcula totalPujado, totalPagado y totalComisiones sumando directamente el valor en ARS mas el valor en USD, mezclando dos monedas distintas. El propio query ya separa correctamente por moneda (totalPujadoARS / totalPujadoUSD), pero luego se entrega tambien el agregado ARS+USD como si fuera un unico numero comparable, lo cual es financieramente incorrecto y puede mostrarse en la UI como una metrica enganosa.
- **Fix propuesto:** Eliminar los campos agregados totalPujado/totalPagado/totalComisiones o, si se quiere un total unico, convertir USD a ARS con USD_TO_ARS_RATE (utils/category.ts) antes de sumar. Mantener siempre los desgloses por moneda que ya existen.

### [DB-08] Falta de indice en mediosDePago.cliente (lookup repetido por cliente en pujas y listados)
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/unified-migrations.sql:205-222`
- **Problema:** `mediosDePago` (L205-222) tiene FK `cliente` sin indice. El codigo filtra constantemente `WHERE cliente = @cliente AND verificado='si' AND activo='si'` para validar que el postor tiene medio de pago verificado antes de aceptar una puja (auctionHandler.ts:155, 267, 494, 650) y para listar medios (mediosPagoController.ts:16). Sin indice es un table scan por cada validacion de puja.
- **Fix propuesto:** Agregar `CREATE INDEX ix_mediosDePago_cliente ON mediosDePago(cliente) INCLUDE (verificado, activo);`.

### [A5-04] bestBid || precioBase trata una mejor oferta de 0 como ausencia de oferta
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:170, 220-221, 317`
- **Problema:** Varias expresiones usan el patron (bestBid || ...) o (response.data?.bestBid || currentItem?.precioBase || 0), que con el operador || colapsa el valor 0 a la rama de fallback. Si en algun escenario bestBid (o data.bestBid) es exactamente 0 (item gratuito, precio base 0, o reseteo), el codigo lo trata como 'no hay oferta' y cae al precioBase. En L220-221 el calculo de min/max usa (bestBid || 0) que es inocuo (0||0===0), pero L170 y L317 (Number(data.bestBid || currentItem?.precioBase || 0)) si pueden descartar un bestBid 0 legitimo proveniente del server. Es un bug latente clasico de || vs ??.
- **Fix propuesto:** Usar el operador de coalescencia nula ?? en lugar de || cuando 0 es un valor valido: setBestBid(Number(data.bestBid ?? currentItem?.precioBase ?? 0)) y Number(response.data?.bestBid ?? currentItem?.precioBase ?? 0). Revisar tambien si el dominio realmente admite precioBase 0; si nunca puede ser 0, documentarlo como simplificacion.

### [A5-09] Callbacks de socket asumen response definido y no manejan ack ausente/error
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:90-110, 267-274, 284-296`
- **Problema:** Los callbacks de join-auction, place-bid y confirm-payment acceden a response.success / response.error / response.data sin verificar que response exista. Si el servidor invoca el ack sin argumento, o socket.io entrega el callback con undefined (caso de timeout en versiones que lo soportan), se produce un TypeError 'Cannot read property success of undefined' que no esta atrapado. En confirm-payment, ademas, no hay rama para mostrar exito parcial ni para distinguir error de red vs error de negocio. performCancelPayment si usa response?.success (optional chaining, L313) - la inconsistencia muestra que el patron defensivo se aplico solo en un lugar.
- **Fix propuesto:** Normalizar todos los callbacks con guard: if (!response || !response.success) { Alert.alert('Error', response?.error || 'Error de comunicacion'); return; }. Aplicar el mismo patron defensivo (response?.) en join-auction, place-bid y confirm-payment para consistencia.

### [A5-11] Doble Alert al confirmar pago tras multa: cierra modal pero igual muestra 'Pago rechazado'
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:289-295`
- **Requisito TPO:** Aplicacion de multa por incumplimiento de pago
- **Problema:** En la rama de error de confirmPayment, cuando se detecta 'multa aplicada' se cierra el modal pero el Alert.alert('Pago rechazado', response.error) de L294 esta FUERA del if, por lo que se ejecuta siempre. El usuario penalizado con multa ve un Alert titulado 'Pago rechazado' en vez de un mensaje especifico de multa. Falta un return tras manejar el caso de multa.
- **Fix propuesto:** Dentro del if de multa, mostrar el Alert especifico y hacer return antes del Alert generico: if (esMulta) { setShowPaymentModal(false); setWonItem(null); Alert.alert('Multa aplicada', response.error); return; } Alert.alert('Pago rechazado', response.error);

### [A6-API-04] console.info de baseURL queda en el bundle de produccion
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-services
- **Ubicacion:** `app/src/services/api.ts:46`
- **Problema:** console.info se ejecuta en el modulo a nivel top-level en cada arranque, sin guard de __DEV__. Filtra la URL del backend en consola en builds de release y agrega ruido. Mismo patron de console.* sin guard aparece en notificaciones.tsx y estadisticas.tsx (ver A6-NOTIF-02).
- **Fix propuesto:** Envolver en if (__DEV__) console.info(...) o eliminarlo. Establecer una convencion de logger condicional para todo el proyecto.

### [A6-VENDER-02] Tipos any en MediosModal y en estado de medios de pago
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(tabs)/vender.tsx:70, 501`
- **Problema:** useState<any[]> para medios y React.FC<any> para MediosModal eliminan el chequeo de tipos justo donde se accede a item.identificador, item.descripcion, item.montoDisponible, item.moneda. El proyecto define CLAUDE.md 'TypeScript everywhere' y otros archivos (pagar.tsx, medios-pago.tsx) ya tienen una interface MedioPago reutilizable. Errores de propiedad pasarian silenciosamente.
- **Fix propuesto:** Reutilizar la interface MedioPago ya existente (extraerla a un tipo compartido en src/types). Tipar useState<MedioPago[]> y definir interface MediosModalProps { visible: boolean; onClose: () => void; medios: MedioPago[]; loading: boolean; onSelect: (id: number) => void }.

### [A6-NOTIF-01] onRefresh no hace await del Promise.all: el spinner de refresh nunca se apaga de forma confiable
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/notificaciones.tsx:93-96`
- **Problema:** onRefresh setea refreshing=true y lanza Promise.all([...]) sin await ni .finally. setRefreshing(false) solo ocurre dentro de fetchNotificaciones (finally) y NO en fetchMultas/fetchMediosPago. El estado refreshing depende de cual termine; si fetchNotificaciones resuelve antes que las otras, el RefreshControl se apaga mientras los otros fetch siguen corriendo, y si fetchNotificaciones falla en red el comportamiento es inconsistente. Ademas Promise.all sin manejo: cualquier rechazo no capturado (cada fetch tiene su try/catch, asi que aqui no rompe, pero la coordinacion del spinner es fragil). Bug de UX visible al hacer pull-to-refresh.
- **Fix propuesto:** Hacer la callback async y await + finally: const onRefresh = useCallback(async () => { setRefreshing(true); try { await Promise.all([fetchNotificaciones(), fetchMultas(), fetchMediosPago()]); } finally { setRefreshing(false); } }, []); y quitar el setRefreshing(false) disperso dentro de fetchNotificaciones para que el control unico viva en onRefresh / carga inicial.

### [A6-AUTH-01] Validacion de email debil: no se valida formato en login ni en registro
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(auth)/login.tsx:16-20`
- **Problema:** La validacion solo comprueba que email y clave no esten vacios. No hay chequeo de formato de email (regex/expo-validator client-side). El register/step2.tsx tampoco valida formato de email (solo no-vacio y largo de clave). El usuario puede mandar 'asd' como email y solo se entera tras el roundtrip al server. Es una validacion debil para un campo clave de autenticacion.
- **Fix propuesto:** Agregar validacion de formato antes de llamar al backend, ej: const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); if (!emailOk) { setError('Email invalido'); return; }. Centralizar en src/utils/validators.ts y reusar en login y register/step2.

### [A6-AUTH-02] Regla de complejidad de clave minima: solo longitud, sin requisitos de complejidad
- **Accion:** CORREGIR · **Riesgo del fix:** low · **Categoria:** requirement-gap · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(auth)/register/step2.tsx:8, 26-29`
- **Problema:** La unica regla de clave en el registro es longitud >= 8 (MIN_PASSWORD_LENGTH). No exige combinacion de mayusculas/minusculas/numeros/simbolos ni rechaza claves comunes. Puede ser una simplificacion academica deliberada, pero conviene reportarlo: una clave como '12345678' es aceptada. La validacion vive solo en el cliente; debe existir tambien en el backend (verificar en revision de server).
- **Fix propuesto:** Si el TPO lo requiere, agregar regla de complejidad (al menos una letra y un numero) con feedback en UI, y replicar la validacion en el backend. Si es simplificacion intencional, dejarlo documentado en milestone.md.

### [BLOG-10] IN clause dinamico construido por concatenacion de IDs en getCatalogo (riesgo SQLi latente / fragilidad)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** security · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/controllers/subastasController.ts:328-339`
- **Problema:** getCatalogo arma 'WHERE producto IN (${productoIds.join(',')})' por interpolacion de string. Hoy productoIds se filtra con typeof === 'number' (linea 323-324), por lo que no hay inyeccion explotable en la practica. Sin embargo es un patron fragil: cualquier cambio que permita que un valor no-numerico entre al arreglo, o reutilizacion del patron en otra query con datos de usuario, abre SQL injection. Va contra la convencion de usar siempre parametros.
- **Fix propuesto:** Parametrizar el IN: generar @p0,@p1,... y request.input por cada id, o usar una tabla temporal / table-valued parameter. Mantener el filtro numerico como defensa adicional.

### [BLOG-13] Pago de subastas en USD no exige medio internacional (transferencia/tarjeta internacional)
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:640-663`
- **Requisito TPO:** req Restricciones (linea 139 TPO)
- **Problema:** El TPO (linea 139) dice que las subastas en dolares deben cancelarse en dicha moneda por transferencia o tarjeta internacional. confirm-payment solo valida que mp.moneda === pending.moneda (USD), pero no verifica el flag internacional ni el tipo de medio. Una tarjeta marcada como moneda USD pero internacional='no' o un cheque en USD pasarian la validacion. El campo internacional se selecciona pero no se usa.
- **Fix propuesto:** Para pending.moneda === 'USD' exigir que el medio sea transferencia/tarjeta con internacional='si' (rechazar cheque y medios no internacionales), alineado con la restriccion del TPO.

### [BLOG-14] cancel-payment puede reabrir el item por debajo de la puja minima sin reprogramar no-bid si quedan pujas previas inexistentes
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:817-869`
- **Requisito TPO:** req Registro de Datos (lineas 9, 143 TPO)
- **Problema:** Al cancelar el pago, se borra la puja ganadora (DELETE FROM pujos) y se reabre el item. Si no quedan pujas previas (getCurrentBestBid devuelve null), reopenedState fija bestBid = pending.importe (el importe del ganador que justo se cancelo) con bestBidderId null, dato inconsistente: muestra como mejor oferta un valor sin puja real detras, y reprograma solo el close-timer (15s) en vez del no-bid-timer largo, por lo que el item se finalizara en 15s con cero pujas reales y caera al camino 'sin pujas / compra empresa'. Ademas borrar la puja contradice el req de conservar 'todos los pujes realizados (concretadas o no)'.
- **Fix propuesto:** No borrar fisicamente la puja: marcarla como no-concretada (ej. ganador='no' + un estado 'cancelada') para preservar el historial (req lineas 9 y 143). Si no quedan pujas reales, reprogramar el no-bid auto-buy en lugar de un close de 15s, y no exponer un bestBid ficticio.

### [DB-13] Integridad referencial incompleta: productos.seguro y solicitudesVenta.productoId pueden quedar sin FK segun orden de ejecucion
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** medium · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/unified-migrations.sql:101-113, 327-328`
- **Problema:** `productos.seguro VARCHAR(30)` (L109) referencia logicamente `seguros.nroPoliza` pero NUNCA se crea una FK (`fk_productos_seguros`) en ningun lado; queda como columna libre sin integridad referencial. Ademas en PHASE 5 (L327-328) se hace `IF COL_LENGTH('productos','seguro') IS NULL ALTER TABLE productos ADD seguro VARCHAR(30) NULL;` lo cual es redundante porque ya se crea en el CREATE TABLE (L109) — sintoma de que el archivo unifico fuentes sin reconciliarlas. La relacion producto-seguro queda sin garantia de existencia de la poliza.
- **Fix propuesto:** Agregar `IF OBJECT_ID('fk_productos_seguros','F') IS NULL ALTER TABLE productos ADD CONSTRAINT fk_productos_seguros FOREIGN KEY (seguro) REFERENCES seguros(nroPoliza);` y eliminar el ADD redundante de L327-328.

### [A6-VENDER-01] MediosModal custom en vender.tsx duplica el componente Modal de src/components y hardcodea colores
- **Accion:** CORREGIR (con cuidado) · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(tabs)/vender.tsx:501-551`
- **Problema:** Existe src/components/Modal.tsx (overlay, centro/bottom, cierre por backdrop, KeyboardAvoidingView, usa tokens del theme), pero vender.tsx importa el Modal crudo de react-native (linea 3) y reimplementa overlay/contenedor con estilos propios (modalStyles). Esos estilos usan hex hardcodeados que ademas no estan en la paleta: 'rgba(0,0,0,0.5)' (existe colors.overlay), 'white' (existe colors.ivory), '#eee', '#666', '#007bff' (azul que no pertenece al design system; lo correcto seria colors.steelBlue o auctionGold). Duplicacion + violacion del design system.
- **Fix propuesto:** Reemplazar MediosModal por el componente compartido: import { Modal } from '../../src/components'; <Modal visible={modalMediosVisible} onClose={...} title='Elegir medio de pago' variant='bottom'>{...lista...}</Modal>. Eliminar modalStyles o, si se mantiene, usar colors.overlay/ivory/border/steelBlue.

### [REQ-04] Limite de cheque certificado (compras <= monto del cheque) no implementado
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/controllers/mediosPagoController.ts:38, 50`
- **Requisito TPO:** Req 21 (cheque certificado: compras no superan el monto del cheque a traves de varias subastas)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El TPO indica que con un cheque certificado las compras del usuario no pueden superar dicho monto, pero mientras alcance puede participar en cuantas subastas quiera (limite acumulado). El codigo guarda montoCheque y usa montoDisponible como saldo decrementable en confirm-payment, pero no hay logica que trate el cheque como un tope acumulado distinto de una cuenta: montoCheque se setea igual al monto inicial y nunca se vuelve a leer para validar. No se distingue el comportamiento de cheque vs cuenta bancaria. En la practica los tres tipos se comportan igual (saldo que baja).
- **Fix propuesto:** En confirm-payment / pagarMulta, cuando el medio es cheque_certificado validar que el total acumulado comprado con ese cheque no supere montoCheque (p.ej. sumando registroDeSubasta pagados con ese medio, o manteniendo montoDisponible como saldo restante y dejando claro que representa el cheque). Documentar la regla acumulada multi-subasta.

### [REQ-05] Costo de envio fijo 5% del importe, no calculado por direccion declarada
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/src/socket/auctionHandler.ts:133`
- **Requisito TPO:** Req 19 (mensaje privado al ganador: importe + comisiones + costo de envio a la direccion declarada)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El TPO pide informar al ganador el 'costo de envio a la direccion declarada'. El costo de envio se calcula como 5% del importe pujado, sin tener en cuenta la direccion del cliente ni el pais/distancia. El importe y la comision si se informan correctamente en createWinnerNotification. Es una simplificacion razonable, pero el costo no depende de la direccion como pide el requisito.
- **Fix propuesto:** Calcular el costo de envio en funcion de la direccion declarada del cliente (personas.direccion / numeroPais), aunque sea con una tabla simple de tarifas por pais o un recargo internacional. Como minimo documentar que el 5% es un placeholder.

### [REQ-09] No existe registro temporal (timestamp) de los pujos; el orden depende del IDENTITY
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** low · **Categoria:** requirement-gap · **Dominio:** requirements
- **Ubicacion:** `server/unified-migrations.sql:155-164`
- **Requisito TPO:** Req 26 (guardar todos los pujes respetando el orden)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El TPO exige guardar todos los pujes 'respetando el orden' temporal. La tabla pujos no tiene columna de fecha/hora; el orden temporal se infiere del identificador IDENTITY (getHistorialPujas ordena por p.identificador ASC, lo cual es un proxy aceptable). Sin embargo, las consultas de mejor oferta ordenan por importe DESC y en algunos casos sin desempate por identificador (subastasController.ts:84 y auctionHandler.ts:319 usan solo ORDER BY importe DESC), lo que ante empates de importe puede devolver un 'mejor postor' no determinista. No hay un timestamp explicito que respalde el requisito de orden.
- **Fix propuesto:** Agregar columna fechaPujo DATETIME DEFAULT GETDATE() a pujos y ordenar por ella (o por identificador como desempate) de forma consistente en TODAS las consultas de mejor oferta (agregar ', p.identificador DESC' donde falte). Esto deja explicito y deterministico el orden temporal.

### [BLOG-09] Costo de envio fabricado como 5% del importe, no por direccion declarada
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/socket/auctionHandler.ts:133`
- **Requisito TPO:** req 19 (lineas 120-123, 188 TPO)
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El TPO (req 19, linea 123 y 188) indica que el costo de envio se calcula a la direccion declarada del comprador. El backend usa costoEnvio = importe * 0.05, una formula inventada independiente del domicilio. El mensaje al ganador (createWinnerNotification) reporta este valor como costo de envio real. Es una simplificacion academica razonable pero debe quedar marcada porque no responde al requisito (envio a direccion declarada).
- **Fix propuesto:** Calcular el envio en base a un parametro de tarifa por zona/domicilio del cliente, o al menos documentar explicitamente que el 5% es una aproximacion academica fija. Exponer el dato como configurable.

### [BLOG-12] getEstadisticas y getHistorialPujas ignoran el parametro :id de la ruta /usuarios/:id/...
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** logica-negocio-backend
- **Ubicacion:** `server/src/controllers/estadisticasController.ts:8, 122-127`
- **Requisito TPO:** Metricas y Estadisticas (lineas 147-154 TPO)
- **Problema:** Las rutas exponen /usuarios/:id/estadisticas e historial-pujas, pero ambos controllers usan siempre req.user!.id e ignoran req.params.id. No es una fuga de datos (siempre devuelve los del usuario autenticado), pero la ruta es enganosa y un cliente que pase otro :id recibe silenciosamente sus propios datos. Ademas en getHistorialPujas el query param subastaId no se valida como entero antes de inyectarlo como input (mssql lo parametriza, pero no hay validacion de tipo ni manejo de subastaId invalido).
- **Fix propuesto:** O bien quitar el :id de la ruta y dejarla /me/estadisticas, o validar que req.params.id === req.user.id (403 si no coincide). En getHistorialPujas validar subastaId con parseInt y rechazar valores no numericos antes de usarlo.
- **Veredicto:** NO confirmado / descartado. El nucleo del hallazgo esta REFUTADO. Las rutas reales (server/src/routes/estadisticas.ts:8-9) son router.get('/estadisticas') y router.get('/historial-pujas'), montadas en '/api/usuarios' (index.ts:66). NO existe ningun parametro :id en la ruta. Las URLs finales son /api/usuarios/estadisticas y /ap

### [DB-05] Ausencia total de scripts DOWN / rollback en las migraciones
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** low · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/unified-migrations.sql:1-391`
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** Ninguna migracion tiene su contraparte DOWN/rollback. `unified-migrations.sql` solo contiene operaciones UP (CREATE/ALTER/INSERT/UPDATE) y `004_add_moneda_to_multas.sql` solo el ADD. No existe forma versionada de revertir un cambio (DROP COLUMN, DROP TABLE, restaurar constraint anterior). El CLAUDE.md declara como regla 'Generate reversible migrations (UP/DOWN)' para el agente db-architect, pero no se cumple. Para un TPO es una simplificacion comprensible, pero hay que reportarla porque rompe la convencion propia del proyecto y dificulta deshacer un deploy fallido.
- **Fix propuesto:** Para cada migracion versionada, agregar un bloque DOWN correspondiente (ej: para PHASE 4, `DROP TABLE cuentasAVista; ... DROP TABLE mediosDePago;` en orden inverso de FKs) en archivos separados `NNN_down.sql`, o documentar explicitamente en milestone.md que el rollback es manual por decision academica.

### [DB-11] Conexion a SQL Server con riesgo de cifrado debil: trustServerCertificate atado a NODE_ENV y scripts JS con encrypt+trustServerCertificate=true
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/src/models/db.ts:12-15`
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** En `db.ts`, `encrypt` se desactiva si `DB_ENCRYPT==='false'` y `trustServerCertificate` es `true` salvo en production. El default de `encrypt` es true, lo cual es correcto, pero permitir `DB_ENCRYPT=false` por env deja abierta la posibilidad de conexion en claro en cualquier entorno por mala config. Mas grave: los scripts utilitarios `create-db.js` (L8-12) y los runners de migracion (run-migrations.js L14-18, run-unified-migrations.js L10) usan `encrypt:true, trustServerCertificate:true` SIEMPRE y con password hardcodeada 'TuContraseña123' en el codigo. trustServerCertificate=true desactiva la validacion del certificado del servidor, exponiendo a MITM; en estos scripts no hay forma de endurecerlo por entorno. Para un TPO con SQL en Docker local es una simplificacion aceptable, pero es un riesgo real si se reusa la config en prod.
- **Fix propuesto:** En db.ts, no permitir desactivar encrypt fuera de desarrollo (forzar encrypt=true si NODE_ENV==='production'). En los scripts JS, leer credenciales y flags TLS desde variables de entorno (dotenv) en vez de hardcodear; documentar que trustServerCertificate=true es solo para el contenedor local de desarrollo.

### [DB-12] Race condition en numeroPostor: SELECT MAX(numeroPostor)+1 sin transaccion ni unicidad
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** db · **Dominio:** db
- **Ubicacion:** `server/src/socket/auctionHandler.ts:515-528`
- **Problema:** El numero de postor se calcula con `SELECT COALESCE(MAX(numeroPostor),0)+1` y luego un INSERT separado (auctionHandler.ts:515-528, identico en subastasController.ts:139-148). Entre el SELECT y el INSERT no hay transaccion ni bloqueo, y `asistentes` no tiene UNIQUE sobre (subasta, numeroPostor) (ver DB-09). Dos clientes uniendose a la misma subasta casi simultaneamente pueden obtener el mismo numeroPostor y ambos insertan sin error. En una subasta en vivo (Socket.IO, alta concurrencia) esto es plausible y produce postores con numero duplicado, ambiguo para identificar al ganador.
- **Fix propuesto:** Agregar `CREATE UNIQUE INDEX ux_asistentes_subasta_postor ON asistentes(subasta, numeroPostor);` y envolver el SELECT MAX + INSERT en una transaccion con `WITH (UPDLOCK, HOLDLOCK)` sobre asistentes, o usar una tabla de secuencias por subasta. Manejar el error de duplicado reintentando.

### [A5-06] Tipado 'any' generalizado en callbacks y payloads de socket
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:62, 90, 122, 145, 151, 157, 164, 183, 267, 284, 311`
- **Problema:** Las respuestas de ack y los payloads de eventos estan tipados como 'any' (response: any, data: any), y el estado wonItem es useState<any>(null). Esto desactiva la verificacion de tipos justo en la frontera mas propensa a errores (datos del server), permitiendo accesos como wonItem.importe, response.data.canBid, data.ganadorNombre sin garantia. Contradice la convencion del proyecto de 'TypeScript everywhere'. Ya existen interfaces (Bid, CurrentItem, MedioPagoOption) que podrian extenderse a las respuestas.
- **Fix propuesto:** Definir interfaces: type AckResponse<T> = { success: boolean; data: T; error?: string }; interface WonItemPayload { itemId: number; importe: number; comision: number; costoEnvio?: number; total?: number; medios: MedioPagoOption[] }; interface ItemSoldPayload { ganadorNombre: string; importe: number }. Tipar los callbacks y useState<WonItemPayload | null>(null).

### [A6-API-02] Refresh de token sin cola ni backoff: rafagas de 401 disparan multiples refresh concurrentes
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** correctness · **Dominio:** frontend-services
- **Ubicacion:** `app/src/services/api.ts:60-88`
- **Nota:** simplificacion academica intencional — fix minimo/determinista + documentar.
- **Problema:** El interceptor de respuesta solo protege contra reintento por-request (originalRequest._retry). No hay una cola/single-flight global. Si la app dispara varias requests en paralelo (ej: notificaciones.tsx hace fetchNotificaciones + fetchMultas + fetchMediosPago juntos, pagar.tsx hace Promise.all de 2 GET) y el accessToken expiro, cada respuesta 401 lanza su propio POST /auth/refresh. Si el refreshToken es de un solo uso (rotacion), el primer refresh lo invalida y los siguientes fallan -> el usuario es deslogueado aunque su sesion era valida. Tampoco hay backoff ante fallo de red en el refresh.
- **Fix propuesto:** Implementar single-flight: una variable module-level `let refreshPromise: Promise<string> | null`. Si ya hay un refresh en curso, los demas requests hacen await de la misma promesa en vez de iniciar otro. Limpiar refreshPromise en finally. Opcionalmente, reintento con backoff exponencial ante error de red (no ante 401/403).
- **Veredicto:** NO confirmado / descartado. REFUTADO en su parte central (severidad high / deslogueo). Verifique los tres archivos.

1) api.ts:60-88 — Confirmado: el interceptor solo tiene guarda por-request (originalRequest._retry = true en linea 66) y NO hay single-flight ni cola module-level. Cada 401 dispara su propio `axios.post(`${API_U

### [A6-NOTIF-02] console.error en produccion y useEffect con dependencias faltantes
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** medium · **Categoria:** code-quality · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/notificaciones.tsx:53-61, 67, 79, 89, 103`
- **Problema:** Multiples console.error sin guard __DEV__ quedan en el bundle de release (mismo patron en estadisticas.tsx:43 y pagar.tsx usa Alert correctamente). Ademas el useEffect inicial usa lista de dependencias vacia [] pero referencia isAuthenticated y las funciones fetch*, lo que el linter de react-hooks marcaria (exhaustive-deps). Funciona por como esta escrito pero es fragil ante refactors.
- **Fix propuesto:** Reemplazar console.error por un logger condicionado a __DEV__ o mostrar feedback al usuario (Alert/toast). Mover las funciones fetch a useCallback y agregarlas (junto a isAuthenticated) a las deps del useEffect, o documentar el lint-disable explicitamente.

### [A6-AUTH-03] Manejo de errores de API inconsistente entre pantallas (setError vs Alert vs console.error vs silencio)
- **Accion:** SOLO REPORTAR · **Riesgo del fix:** low · **Categoria:** code-quality · **Dominio:** frontend-ui
- **Ubicacion:** `app/app/(auth)/login.tsx:25-26`
- **Problema:** El acceso al mensaje de error del backend (err.response?.data?.error) se repite copiado en login.tsx, register/step1.tsx, register/step2.tsx, vender.tsx, pagar.tsx y medios-pago.tsx, pero la forma de mostrarlo varia: login/register usan setError + <Text>, vender/pagar/medios usan Alert, notificaciones/estadisticas usan console.error o silencio, e index.tsx silencia el catch. No hay un helper comun de extraccion de mensaje ni un patron unico de presentacion, lo que produce UX dispar (a veces el usuario no ve nada). El tipo err:any tambien se repite.
- **Fix propuesto:** Crear src/utils/apiError.ts con getApiErrorMessage(err: unknown): string que normalice err.response?.data?.error, timeouts (ECONNABORTED) y errores de red. Definir una convencion unica (toast/setError) y reusarla en todas las pantallas.

---

## NONE (1)

### [A5-10] Validacion de puja con bestBid=0 muestra mensaje confuso cuando no hay ofertas
- **Accion:** DESCARTADO · **Riesgo del fix:** low · **Categoria:** correctness · **Dominio:** frontend-live-sockets
- **Ubicacion:** `app/app/subasta/[id]/live.tsx:243-257`
- **Problema:** En handleBid, cuando bestBid es 0 (estado inicial antes de recibir cualquier oferta o si el server aun no respondio), la validacion importe <= bestBid (L243) se vuelve importe <= 0, que ya esta cubierto por L231, y minBid = 0 + base*0.01. Esto es funcionalmente tolerable, pero el mensaje 'La puja debe ser mayor a 0' (L244) es confuso para el usuario si todavia no cargo el precio base como piso. La validacion del cliente es ademas solo cosmetica (el server revalida), pero el wording deberia reflejar el piso real (precioBase) cuando no hay ofertas.
- **Fix propuesto:** Cuando no haya oferta previa, comparar contra el piso real: const piso = bestBidder ? bestBid : Number(currentItem.precioBase); y usar formatPrice(piso) en el mensaje. Garantizar que bestBid se inicialice a precioBase al cargar el item (ya se hace en L104), pero usar ?? en vez de depender de truthiness.
- **Veredicto:** NO confirmado / descartado. REFUTADO. La premisa central del hallazgo es incorrecta. Lei C:\DA1\proyecto\app\app\subasta\[id]\live.tsx.

1) bestBid inicia en 0 (L55), pero handleBid tiene un guard previo: L236-239 `if (!currentItem) { Alert.alert('No hay item activo'); return; }`. La validacion de L243 SOLO se alcanza cuando c

---

