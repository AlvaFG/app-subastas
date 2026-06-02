-- Requisitos de negocio del TPO no cubiertos aun.

-- §166-168: el vendedor declara poder acreditar el origen licito del bien.
IF COL_LENGTH('solicitudesVenta', 'origenLicito') IS NULL
  ALTER TABLE solicitudesVenta ADD origenLicito VARCHAR(2) NULL
    CONSTRAINT chkOrigenLicito CHECK (origenLicito IN ('si', 'no'));
GO

-- §125: retiro personal vs envio en la compra ganada. El registro de venta guarda
-- el modo de entrega, el costo de envio efectivo y si el comprador conserva el seguro.
IF COL_LENGTH('registroDeSubasta', 'modoEntrega') IS NULL
  ALTER TABLE registroDeSubasta ADD modoEntrega VARCHAR(10) NULL
    CONSTRAINT chkModoEntrega CHECK (modoEntrega IN ('envio', 'retiro'));
GO
IF COL_LENGTH('registroDeSubasta', 'costoEnvio') IS NULL
  ALTER TABLE registroDeSubasta ADD costoEnvio DECIMAL(18,2) NULL;
GO
IF COL_LENGTH('registroDeSubasta', 'seguroComprador') IS NULL
  ALTER TABLE registroDeSubasta ADD seguroComprador VARCHAR(2) NULL
    CONSTRAINT chkSeguroComprador CHECK (seguroComprador IN ('si', 'no'));
GO

-- §190: las cuentas a la vista deben declararse ANTES del inicio de la subasta.
-- Guardamos la fecha de declaracion para poder auditarlo.
IF COL_LENGTH('cuentasAVista', 'fechaDeclaracion') IS NULL
  ALTER TABLE cuentasAVista ADD fechaDeclaracion DATETIME NOT NULL
    CONSTRAINT df_cuentasAVista_fecha DEFAULT GETDATE();
GO

-- @DOWN
IF OBJECT_ID('df_cuentasAVista_fecha', 'D') IS NOT NULL ALTER TABLE cuentasAVista DROP CONSTRAINT df_cuentasAVista_fecha;
GO
IF COL_LENGTH('cuentasAVista', 'fechaDeclaracion') IS NOT NULL ALTER TABLE cuentasAVista DROP COLUMN fechaDeclaracion;
GO
IF OBJECT_ID('chkSeguroComprador', 'C') IS NOT NULL ALTER TABLE registroDeSubasta DROP CONSTRAINT chkSeguroComprador;
GO
IF COL_LENGTH('registroDeSubasta', 'seguroComprador') IS NOT NULL ALTER TABLE registroDeSubasta DROP COLUMN seguroComprador;
GO
IF COL_LENGTH('registroDeSubasta', 'costoEnvio') IS NOT NULL ALTER TABLE registroDeSubasta DROP COLUMN costoEnvio;
GO
IF OBJECT_ID('chkModoEntrega', 'C') IS NOT NULL ALTER TABLE registroDeSubasta DROP CONSTRAINT chkModoEntrega;
GO
IF COL_LENGTH('registroDeSubasta', 'modoEntrega') IS NOT NULL ALTER TABLE registroDeSubasta DROP COLUMN modoEntrega;
GO
IF OBJECT_ID('chkOrigenLicito', 'C') IS NOT NULL ALTER TABLE solicitudesVenta DROP CONSTRAINT chkOrigenLicito;
GO
IF COL_LENGTH('solicitudesVenta', 'origenLicito') IS NOT NULL ALTER TABLE solicitudesVenta DROP COLUMN origenLicito;
GO
