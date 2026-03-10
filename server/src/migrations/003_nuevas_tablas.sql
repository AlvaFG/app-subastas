-- Migration 003: Tablas nuevas requeridas por la app
-- UP

-- Medios de pago (cuentas bancarias, tarjetas, cheques)
CREATE TABLE mediosDePago (
    identificador INT NOT NULL IDENTITY,
    cliente INT NOT NULL,
    tipo VARCHAR(20) CONSTRAINT chkTipoPago CHECK (tipo IN ('cuenta_bancaria', 'tarjeta_credito', 'cheque_certificado')),
    descripcion VARCHAR(250) NOT NULL,
    -- Datos cuenta bancaria
    banco VARCHAR(150) NULL,
    numeroCuenta VARCHAR(50) NULL,
    cbu VARCHAR(30) NULL,
    moneda VARCHAR(3) CONSTRAINT chkMonedaPago CHECK (moneda IN ('ARS', 'USD')) DEFAULT 'ARS',
    -- Datos tarjeta
    ultimosDigitos VARCHAR(4) NULL,
    internacional VARCHAR(2) CONSTRAINT chkInternacional CHECK (internacional IN ('si', 'no')) DEFAULT 'no',
    -- Datos cheque
    montoCheque DECIMAL(18,2) NULL CONSTRAINT chkMontoCheque CHECK (montoCheque IS NULL OR montoCheque > 0),
    montoDisponible DECIMAL(18,2) NULL,
    -- Estado
    verificado VARCHAR(2) CONSTRAINT chkVerificado CHECK (verificado IN ('si', 'no')) DEFAULT 'no',
    activo VARCHAR(2) CONSTRAINT chkActivoPago CHECK (activo IN ('si', 'no')) DEFAULT 'si',
    CONSTRAINT pk_mediosDePago PRIMARY KEY (identificador),
    CONSTRAINT fk_mediosDePago_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador)
);
GO

-- Sesiones (JWT refresh tokens)
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
GO

-- Notificaciones (mensajes privados, alertas)
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
GO

-- Multas (10% por impago)
CREATE TABLE multas (
    identificador INT NOT NULL IDENTITY,
    cliente INT NOT NULL,
    subasta INT NOT NULL,
    item INT NOT NULL,
    importeOriginal DECIMAL(18,2) NOT NULL,
    importeMulta DECIMAL(18,2) NOT NULL,
    pagada VARCHAR(2) CONSTRAINT chkPagada CHECK (pagada IN ('si', 'no')) DEFAULT 'no',
    fechaMulta DATETIME NOT NULL DEFAULT GETDATE(),
    fechaLimite DATETIME NOT NULL, -- 72hs para presentar fondos
    derivadaJusticia VARCHAR(2) CONSTRAINT chkDerivada CHECK (derivadaJusticia IN ('si', 'no')) DEFAULT 'no',
    CONSTRAINT pk_multas PRIMARY KEY (identificador),
    CONSTRAINT fk_multas_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador),
    CONSTRAINT fk_multas_subastas FOREIGN KEY (subasta) REFERENCES subastas (identificador),
    CONSTRAINT fk_multas_items FOREIGN KEY (item) REFERENCES itemsCatalogo (identificador)
);
GO

-- Solicitudes de venta (usuarios que quieren vender items)
CREATE TABLE solicitudesVenta (
    identificador INT NOT NULL IDENTITY,
    cliente INT NOT NULL,
    descripcion VARCHAR(500) NOT NULL,
    datosHistoricos VARCHAR(1000) NULL,
    declaracionPropiedad VARCHAR(2) CONSTRAINT chkDeclaracion CHECK (declaracionPropiedad = 'si') NOT NULL,
    estado VARCHAR(20) CONSTRAINT chkEstadoSolicitud CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'devuelta')) DEFAULT 'pendiente',
    motivoRechazo VARCHAR(500) NULL,
    fechaSolicitud DATETIME NOT NULL DEFAULT GETDATE(),
    -- Datos post-aceptacion
    valorBase DECIMAL(18,2) NULL,
    comisionPropuesta DECIMAL(18,2) NULL,
    aceptadoPorUsuario VARCHAR(2) CONSTRAINT chkAceptadoUsuario CHECK (aceptadoPorUsuario IN ('si', 'no')) NULL,
    CONSTRAINT pk_solicitudesVenta PRIMARY KEY (identificador),
    CONSTRAINT fk_solicitudesVenta_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador)
);
GO

-- Depositos (ubicacion fisica de piezas)
CREATE TABLE depositos (
    identificador INT NOT NULL IDENTITY,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(350) NOT NULL,
    CONSTRAINT pk_depositos PRIMARY KEY (identificador)
);
GO

-- Relacion producto-deposito
ALTER TABLE productos ADD deposito INT NULL;
ALTER TABLE productos ADD CONSTRAINT fk_productos_depositos FOREIGN KEY (deposito) REFERENCES depositos (identificador);
GO

-- Cuentas a la vista (para pagos a duenos)
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

-- DOWN
-- DROP TABLE cuentasAVista;
-- ALTER TABLE productos DROP CONSTRAINT fk_productos_depositos;
-- ALTER TABLE productos DROP COLUMN deposito;
-- DROP TABLE depositos;
-- DROP TABLE solicitudesVenta;
-- DROP TABLE multas;
-- DROP TABLE notificaciones;
-- DROP TABLE sesiones;
-- DROP TABLE mediosDePago;
