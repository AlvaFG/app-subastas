-- Correccion 1 (cierre programado): la subasta deja de cerrarse por inactividad
-- (15s desde la ultima puja) y pasa a cerrar en una fecha/hora de fin definida por
-- la empresa al crear la subasta. Todos los items quedan abiertos hasta ese momento;
-- al cerrar, cada item se adjudica a su mejor postor.
--
-- Se guardan como fecha (DATE) + hora (TIME) para mantener el mismo patron que el
-- inicio (subastas.fecha / subastas.hora). Sin CHECK estricto: la validacion (fin
-- posterior al inicio / futuro) se hace en la capa de aplicacion para no romper
-- filas existentes ni el armado de subastas de prueba.

IF COL_LENGTH('subastas', 'fechaFin') IS NULL
  ALTER TABLE subastas ADD fechaFin DATE NULL;
GO

IF COL_LENGTH('subastas', 'horaFin') IS NULL
  ALTER TABLE subastas ADD horaFin TIME NULL;
GO

-- El check original exigia que el INICIO de la subasta fuera siempre >10 dias a
-- futuro. Con el nuevo modelo la empresa define inicio y fin explicitos al armar la
-- subasta (puede abrirse de inmediato y cerrar en la fecha/hora pactada), por lo que
-- esa restriccion ya no aplica. La validacion de fechas se hace en la aplicacion.
IF OBJECT_ID('chkFecha', 'C') IS NOT NULL
  ALTER TABLE subastas DROP CONSTRAINT chkFecha;
GO

-- @DOWN
IF OBJECT_ID('chkFecha', 'C') IS NULL
  ALTER TABLE subastas ADD CONSTRAINT chkFecha CHECK (fecha > dateAdd(dd, 10, getdate()));
GO
IF COL_LENGTH('subastas', 'horaFin') IS NOT NULL ALTER TABLE subastas DROP COLUMN horaFin;
GO
IF COL_LENGTH('subastas', 'fechaFin') IS NOT NULL ALTER TABLE subastas DROP COLUMN fechaFin;
GO
