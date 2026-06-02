-- UNIFIED MIGRATIONS (baseline 000): complete base database schema
-- IDEMPOTENT: every object is guarded so this file can be re-run safely.
-- Incremental changes live in server/migrations/NNN_*.sql and are tracked in
-- the schema_version table by run-migrations.js.

-- ============================================
-- PHASE 1: Base schema (from EstructuraActual.sql)
-- ============================================

GO

IF OBJECT_ID('paises', 'U') IS NULL
CREATE TABLE paises(
	numero int not null,
	nombre varchar(250) not null,
	nombreCorto varchar(250) null,
	capital varchar(250) not null,
	nacionalidad varchar(250) not null,
	idiomas varchar(150) not null,
	constraint pk_paises primary key (numero)
);

IF OBJECT_ID('personas', 'U') IS NULL
CREATE TABLE personas(
	identificador int not null identity,
	documento varchar(20) not null,
	nombre varchar(150) not null,
	direccion varchar(250),
	estado varchar(15) constraint chkEstado check (estado in ('activo', 'inactivo')),
	foto varbinary(max),
	constraint pk_personas primary key (identificador)
);

IF OBJECT_ID('empleados', 'U') IS NULL
CREATE TABLE empleados(
	identificador int not null,
	cargo varchar(100),
	sector int null,
	constraint pk_empleados primary key (identificador)
);

IF OBJECT_ID('sectores', 'U') IS NULL
CREATE TABLE sectores(
	identificador int not null identity,
	nombreSector varchar(150) not null,
	codigoSector varchar(10) null,
	responsableSector int null,
	constraint pk_sectores primary key (identificador),
	constraint fk_sectores_empleados foreign key (responsableSector) references empleados
);

IF OBJECT_ID('seguros', 'U') IS NULL
CREATE TABLE seguros(
	nroPoliza varchar(30) not null,
	compania varchar(150) not null,
	polizaCombinada varchar(2) constraint chkpolizaCombinada check(polizaCombinada in ('si','no')),
	importe decimal(18,2) not null constraint chkImporte check (importe > 0),
	constraint pk_seguro primary key (nroPoliza)
);

IF OBJECT_ID('clientes', 'U') IS NULL
CREATE TABLE clientes(
	identificador int not null,
	numeroPais int,
	admitido varchar(2) constraint chkAdmitido check(admitido in ('si','no')),
	categoria varchar(10) constraint chkCategoria check (categoria in ('comun', 'especial', 'plata', 'oro', 'platino')),
	verificador int not null,
	constraint pk_clientes primary key (identificador),
	constraint fk_clientes_personas foreign key (identificador) references personas,
	constraint fk_clientes_empleados foreign key (verificador) references empleados (identificador),
	constraint fk_clientes_paises foreign key (numeroPais) references paises (numero)
);

IF OBJECT_ID('duenios', 'U') IS NULL
CREATE TABLE duenios(
	identificador int not null,
	numeroPais int,
	verificacionFinanciera varchar(2) constraint chkVF check(verificacionFinanciera in ('si','no')),
	verificacionJudicial varchar(2) constraint chkVJ check(verificacionJudicial in ('si','no')),
	calificacionRiesgo int constraint chkCR check(calificacionRiesgo in (1,2,3,4,5,6)),
	verificador int not null,
	constraint pk_duenios primary key (identificador),
	constraint fk_duenios_personas foreign key (identificador) references personas,
	constraint fk_duenios_empleados foreign key (verificador) references empleados (identificador)
);

IF OBJECT_ID('subastadores', 'U') IS NULL
CREATE TABLE subastadores(
	identificador int not null,
	matricula varchar(15),
	region varchar(50),
	constraint pk_subastadores primary key (identificador),
	constraint fk_subastadores_personas foreign key (identificador) references personas
);

IF OBJECT_ID('subastas', 'U') IS NULL
CREATE TABLE subastas(
	identificador int not null identity,
	fecha date constraint chkFecha check (fecha > dateAdd(dd, 10, getdate())),
	hora time not null,
	estado varchar(10) constraint chkES check (estado in ('abierta','cerrada')),
	subastador int null,
	ubicacion varchar(350) null,
	capacidadAsistentes int null,
	tieneDeposito varchar(2) constraint chkTD check(tieneDeposito in ('si','no')),
	seguridadPropia varchar(2) constraint chkSP check(seguridadPropia in ('si','no')),
	categoria varchar(10) constraint chkCS check (categoria in ('comun', 'especial', 'plata', 'oro', 'platino')),
	constraint pk_subastas primary key (identificador),
	constraint fk_subastas_subastadores foreign key (subastador) references subastadores(identificador)
);

IF OBJECT_ID('productos', 'U') IS NULL
CREATE TABLE productos(
	identificador int not null identity,
	fecha date,
	disponible varchar(2) constraint chkD check (disponible in ('si','no')),
	descripcionCatalogo varchar(500) null default 'No Posee',
	descripcionCompleta varchar(300) not null,
	revisor int not null,
	duenio int not null,
	seguro varchar(30) null,
	constraint pk_productos primary key (identificador),
	constraint fk_productos_empleados foreign key (revisor) references empleados(identificador),
	constraint fk_productos_duenios foreign key (duenio) references duenios(identificador)
);

IF OBJECT_ID('fotos', 'U') IS NULL
CREATE TABLE fotos(
	identificador int not null identity,
	producto int not null,
	foto varbinary (max) not null,
	constraint pk_fotos primary key (identificador),
	constraint fk_fotos_productos foreign key (producto) references productos(identificador)
);

IF OBJECT_ID('catalogos', 'U') IS NULL
CREATE TABLE catalogos(
	identificador int not null identity,
	descripcion varchar(250) not null,
	subasta int null,
	responsable int not null,
	constraint pk_catalogos primary key (identificador),
	constraint fk_catalogos_empleados foreign key (responsable) references empleados(identificador),
	constraint fk_catalogos_subastas foreign key (subasta) references subastas(identificador)
);

IF OBJECT_ID('itemsCatalogo', 'U') IS NULL
CREATE TABLE itemsCatalogo(
	identificador int not null identity,
	catalogo int not null,
	producto int not null,
	precioBase decimal(18,2) not null constraint chkPB check (precioBase > 0.01),
	comision decimal(18,2) not null constraint chkC check (comision > 0.01),
	subastado varchar(2) constraint chkS check (subastado in ('si','no')),
	constraint pk_itemsCatalogo primary key (identificador),
	constraint fk_itemsCatalogo_catalogos foreign key (catalogo) references catalogos,
	constraint fk_itemsCatalogo_productos foreign key (producto) references productos
);

IF OBJECT_ID('asistentes', 'U') IS NULL
CREATE TABLE asistentes(
	identificador int not null identity,
	numeroPostor int not null,
	cliente int not null,
	subasta int not null,
	constraint pk_asistentes primary key (identificador),
	constraint fk_asistentes_clientes foreign key (cliente) references clientes,
	constraint fk_asistentes_subasta foreign key (subasta) references subastas
);

IF OBJECT_ID('pujos', 'U') IS NULL
CREATE TABLE pujos(
	identificador int not null identity,
	asistente int not null,
	item int not null,
	importe decimal(18,2) not null constraint chkI check (importe > 0.01),
	ganador varchar(2) constraint chkG check (ganador in ('si','no')) default 'no',
	constraint pk_pujos primary key (identificador),
	constraint fk_pujos_asistentes foreign key (asistente) references asistentes,
	constraint fk_pujos_itemsCatalogo foreign key (item) references itemsCatalogo
);

IF OBJECT_ID('registroDeSubasta', 'U') IS NULL
CREATE TABLE registroDeSubasta(
	identificador int not null identity,
	subasta int not null,
	duenio int not null,
	producto int not null,
	cliente int not null,
	importe decimal(18,2) not null constraint chkImportePagado check (importe > 0.01),
	comision decimal(18,2) not null constraint chkComisionPagada check (comision > 0.01),
	constraint pk_registroDeSubasta primary key (identificador),
	constraint fk_registroDeSubasta_subastas foreign key (subasta) references subastas,
	constraint fk_registroDeSubasta_duenios foreign key (duenio) references duenios,
	constraint fk_registroDeSubasta_producto foreign key (producto) references productos,
	constraint fk_registroDeSubasta_cliente foreign key (cliente) references clientes
);

GO

-- ============================================
-- PHASE 2: Constraint typo fixes (idempotent)
-- ============================================

IF OBJECT_ID('chkEstado', 'C') IS NOT NULL
	ALTER TABLE personas DROP CONSTRAINT chkEstado;
GO
IF OBJECT_ID('chkEstado', 'C') IS NULL
	ALTER TABLE personas ADD CONSTRAINT chkEstado CHECK (estado IN ('activo', 'inactivo'));
GO
IF OBJECT_ID('chkES', 'C') IS NOT NULL
	ALTER TABLE subastas DROP CONSTRAINT chkES;
GO
IF OBJECT_ID('chkES', 'C') IS NULL
	ALTER TABLE subastas ADD CONSTRAINT chkES CHECK (estado IN ('abierta', 'cerrada'));
GO

-- ============================================
-- PHASE 3: New columns on existing tables (idempotent)
-- ============================================

IF COL_LENGTH('subastas', 'moneda') IS NULL
	ALTER TABLE subastas ADD moneda VARCHAR(3) CONSTRAINT chkMoneda CHECK (moneda IN ('ARS', 'USD')) DEFAULT 'ARS';
GO
IF COL_LENGTH('clientes', 'email') IS NULL
	ALTER TABLE clientes ADD email VARCHAR(250) NULL;
GO
IF COL_LENGTH('clientes', 'claveHash') IS NULL
	ALTER TABLE clientes ADD claveHash VARCHAR(250) NULL;
GO

-- ============================================
-- PHASE 4: New tables (idempotent)
-- ============================================

IF OBJECT_ID('mediosDePago', 'U') IS NULL
CREATE TABLE mediosDePago (
	identificador INT NOT NULL IDENTITY,
	cliente INT NOT NULL,
	tipo VARCHAR(20) CONSTRAINT chkTipoPago CHECK (tipo IN ('cuenta_bancaria', 'tarjeta_credito', 'cheque_certificado')),
	descripcion VARCHAR(250) NOT NULL,
	banco VARCHAR(150) NULL,
	numeroCuenta VARCHAR(50) NULL,
	cbu VARCHAR(30) NULL,
	moneda VARCHAR(3) CONSTRAINT chkMonedaPago CHECK (moneda IN ('ARS', 'USD')) DEFAULT 'ARS',
	ultimosDigitos VARCHAR(4) NULL,
	internacional VARCHAR(2) CONSTRAINT chkInternacional CHECK (internacional IN ('si', 'no')) DEFAULT 'no',
	montoCheque DECIMAL(18,2) NULL CONSTRAINT chkMontoCheque CHECK (montoCheque IS NULL OR montoCheque > 0),
	montoDisponible DECIMAL(18,2) NULL,
	verificado VARCHAR(2) CONSTRAINT chkVerificado CHECK (verificado IN ('si', 'no')) DEFAULT 'no',
	activo VARCHAR(2) CONSTRAINT chkActivoPago CHECK (activo IN ('si', 'no')) DEFAULT 'si',
	CONSTRAINT pk_mediosDePago PRIMARY KEY (identificador),
	CONSTRAINT fk_mediosDePago_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador)
);

IF OBJECT_ID('sesiones', 'U') IS NULL
CREATE TABLE sesiones (
	identificador INT NOT NULL IDENTITY,
	cliente INT NOT NULL,
	refreshToken VARCHAR(500) NOT NULL,
	fechaCreacion DATETIME NOT NULL DEFAULT GETDATE(),
	fechaExpiracion DATETIME NOT NULL,
	activo VARCHAR(2) CONSTRAINT chkActivoSesion CHECK (activo IN ('si', 'no')) DEFAULT 'si',
	CONSTRAINT pk_sesiones PRIMARY KEY (identificador),
	CONSTRAINT fk_sesiones_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador)
);

IF OBJECT_ID('notificaciones', 'U') IS NULL
CREATE TABLE notificaciones (
	identificador INT NOT NULL IDENTITY,
	cliente INT NOT NULL,
	tipo VARCHAR(30) CONSTRAINT chkTipoNotif CHECK (tipo IN ('ganador', 'multa', 'inspeccion', 'pago', 'sistema')),
	titulo VARCHAR(250) NOT NULL,
	mensaje VARCHAR(1000) NOT NULL,
	leida VARCHAR(2) CONSTRAINT chkLeida CHECK (leida IN ('si', 'no')) DEFAULT 'no',
	fecha DATETIME NOT NULL DEFAULT GETDATE(),
	CONSTRAINT pk_notificaciones PRIMARY KEY (identificador),
	CONSTRAINT fk_notificaciones_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador)
);

IF OBJECT_ID('multas', 'U') IS NULL
CREATE TABLE multas (
	identificador INT NOT NULL IDENTITY,
	cliente INT NOT NULL,
	subasta INT NOT NULL,
	item INT NOT NULL,
	importeOriginal DECIMAL(18,2) NOT NULL,
	importeMulta DECIMAL(18,2) NOT NULL,
	pagada VARCHAR(2) CONSTRAINT chkPagada CHECK (pagada IN ('si', 'no')) DEFAULT 'no',
	fechaMulta DATETIME NOT NULL DEFAULT GETDATE(),
	fechaLimite DATETIME NOT NULL,
	derivadaJusticia VARCHAR(2) CONSTRAINT chkDerivada CHECK (derivadaJusticia IN ('si', 'no')) DEFAULT 'no',
	CONSTRAINT pk_multas PRIMARY KEY (identificador),
	CONSTRAINT fk_multas_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador),
	CONSTRAINT fk_multas_subastas FOREIGN KEY (subasta) REFERENCES subastas (identificador),
	CONSTRAINT fk_multas_items FOREIGN KEY (item) REFERENCES itemsCatalogo (identificador)
);

IF OBJECT_ID('solicitudesVenta', 'U') IS NULL
CREATE TABLE solicitudesVenta (
	identificador INT NOT NULL IDENTITY,
	cliente INT NOT NULL,
	descripcion VARCHAR(500) NOT NULL,
	datosHistoricos VARCHAR(1000) NULL,
	declaracionPropiedad VARCHAR(2) CONSTRAINT chkDeclaracion CHECK (declaracionPropiedad = 'si') NOT NULL,
	estado VARCHAR(20) CONSTRAINT chkEstadoSolicitud CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'devuelta')) DEFAULT 'pendiente',
	motivoRechazo VARCHAR(500) NULL,
	fechaSolicitud DATETIME NOT NULL DEFAULT GETDATE(),
	valorBase DECIMAL(18,2) NULL,
	comisionPropuesta DECIMAL(18,2) NULL,
	aceptadoPorUsuario VARCHAR(2) CONSTRAINT chkAceptadoUsuario CHECK (aceptadoPorUsuario IN ('si', 'no')) NULL,
	CONSTRAINT pk_solicitudesVenta PRIMARY KEY (identificador),
	CONSTRAINT fk_solicitudesVenta_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador)
);

IF OBJECT_ID('depositos', 'U') IS NULL
CREATE TABLE depositos (
	identificador INT NOT NULL IDENTITY,
	nombre VARCHAR(150) NOT NULL,
	direccion VARCHAR(350) NOT NULL,
	CONSTRAINT pk_depositos PRIMARY KEY (identificador)
);

IF COL_LENGTH('productos', 'deposito') IS NULL
	ALTER TABLE productos ADD deposito INT NULL;
GO
IF OBJECT_ID('fk_productos_depositos', 'F') IS NULL
	ALTER TABLE productos ADD CONSTRAINT fk_productos_depositos FOREIGN KEY (deposito) REFERENCES depositos (identificador);
GO

IF OBJECT_ID('cuentasAVista', 'U') IS NULL
CREATE TABLE cuentasAVista (
	identificador INT NOT NULL IDENTITY,
	duenio INT NOT NULL,
	banco VARCHAR(150) NOT NULL,
	numeroCuenta VARCHAR(50) NOT NULL,
	cbu VARCHAR(30) NULL,
	moneda VARCHAR(3) CONSTRAINT chkMonedaCuenta CHECK (moneda IN ('ARS', 'USD')) DEFAULT 'ARS',
	pais INT NULL,
	activa VARCHAR(2) CONSTRAINT chkActivaCuenta CHECK (activa IN ('si', 'no')) DEFAULT 'si',
	CONSTRAINT pk_cuentasAVista PRIMARY KEY (identificador),
	CONSTRAINT fk_cuentasAVista_duenios FOREIGN KEY (duenio) REFERENCES duenios (identificador),
	CONSTRAINT fk_cuentasAVista_paises FOREIGN KEY (pais) REFERENCES paises (numero)
);

GO

-- ============================================
-- PHASE 5: seguros enrichment + seed data (idempotent)
-- ============================================

IF COL_LENGTH('seguros', 'tipoPoliza') IS NULL
	ALTER TABLE seguros ADD tipoPoliza VARCHAR(50) NULL;
GO
IF COL_LENGTH('seguros', 'valorBaseMin') IS NULL
	ALTER TABLE seguros ADD valorBaseMin DECIMAL(18,2) NULL;
GO
IF COL_LENGTH('seguros', 'valorBaseMax') IS NULL
	ALTER TABLE seguros ADD valorBaseMax DECIMAL(18,2) NULL;
GO
IF COL_LENGTH('seguros', 'depositoPreferido') IS NULL
	ALTER TABLE seguros ADD depositoPreferido INT NULL;
GO
IF OBJECT_ID('fk_seguros_depositoPreferido', 'F') IS NULL
	ALTER TABLE seguros ADD CONSTRAINT fk_seguros_depositoPreferido FOREIGN KEY (depositoPreferido) REFERENCES depositos (identificador);
GO
IF COL_LENGTH('solicitudesVenta', 'productoId') IS NULL
	ALTER TABLE solicitudesVenta ADD productoId INT NULL;
GO
IF OBJECT_ID('fk_solicitudesVenta_productos', 'F') IS NULL
	ALTER TABLE solicitudesVenta ADD CONSTRAINT fk_solicitudesVenta_productos FOREIGN KEY (productoId) REFERENCES productos (identificador);
GO
IF COL_LENGTH('productos', 'seguro') IS NULL
	ALTER TABLE productos ADD seguro VARCHAR(30) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM depositos WHERE nombre = 'Deposito Central')
	INSERT INTO depositos (nombre, direccion) VALUES ('Deposito Central', 'Av. Principal 100');
IF NOT EXISTS (SELECT 1 FROM depositos WHERE nombre = 'Deposito Norte')
	INSERT INTO depositos (nombre, direccion) VALUES ('Deposito Norte', 'Calle Norte 50');
IF NOT EXISTS (SELECT 1 FROM depositos WHERE nombre = 'Deposito Sur')
	INSERT INTO depositos (nombre, direccion) VALUES ('Deposito Sur', 'Ruta 5 Km 12');

IF NOT EXISTS (SELECT 1 FROM seguros WHERE nroPoliza = 'POL-1000')
	INSERT INTO seguros (nroPoliza, compania, polizaCombinada, importe, tipoPoliza, valorBaseMin, valorBaseMax, depositoPreferido)
	VALUES ('POL-1000', 'Cobertura Esencial', 'no', 1000.00, 'esencial', 0.01, 5000.00, (SELECT TOP 1 identificador FROM depositos WHERE nombre = 'Deposito Central'));
IF NOT EXISTS (SELECT 1 FROM seguros WHERE nroPoliza = 'POL-5000')
	INSERT INTO seguros (nroPoliza, compania, polizaCombinada, importe, tipoPoliza, valorBaseMin, valorBaseMax, depositoPreferido)
	VALUES ('POL-5000', 'Cobertura Estandar', 'no', 5000.00, 'estandar', 5000.01, 20000.00, (SELECT TOP 1 identificador FROM depositos WHERE nombre = 'Deposito Norte'));
IF NOT EXISTS (SELECT 1 FROM seguros WHERE nroPoliza = 'POL-10000')
	INSERT INTO seguros (nroPoliza, compania, polizaCombinada, importe, tipoPoliza, valorBaseMin, valorBaseMax, depositoPreferido)
	VALUES ('POL-10000', 'Cobertura Extendida', 'no', 10000.00, 'extendida', 20000.01, 50000.00, (SELECT TOP 1 identificador FROM depositos WHERE nombre = 'Deposito Sur'));
IF NOT EXISTS (SELECT 1 FROM seguros WHERE nroPoliza = 'POL-20000')
	INSERT INTO seguros (nroPoliza, compania, polizaCombinada, importe, tipoPoliza, valorBaseMin, valorBaseMax, depositoPreferido)
	VALUES ('POL-20000', 'Cobertura Premium', 'no', 20000.00, 'premium', 50000.01, NULL, (SELECT TOP 1 identificador FROM depositos WHERE nombre = 'Deposito Sur'));
GO
