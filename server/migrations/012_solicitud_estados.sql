-- Estados de dominio de solicitudes de venta (A9/W9-W10).
-- El flujo correcto es: usuario PROPONE -> empresa INSPECCIONA y define precio
-- base/comision (acepta o rechaza con motivo) -> usuario ACEPTA/RECHAZA las
-- condiciones (rechazo => devolucion CON CARGO). Agregamos el estado intermedio
-- 'en_inspeccion', la auditoria de inspeccion y el cargo de devolucion.

-- Ampliar el CHECK de estado para incluir 'en_inspeccion'.
IF OBJECT_ID('chkEstadoSolicitud', 'C') IS NOT NULL
  ALTER TABLE solicitudesVenta DROP CONSTRAINT chkEstadoSolicitud;
GO
IF OBJECT_ID('chkEstadoSolicitud', 'C') IS NULL
  ALTER TABLE solicitudesVenta ADD CONSTRAINT chkEstadoSolicitud
    CHECK (estado IN ('pendiente', 'en_inspeccion', 'aceptada', 'rechazada', 'devuelta'));
GO

-- Auditoria de inspeccion (quien y cuando).
IF COL_LENGTH('solicitudesVenta', 'inspeccionadoEl') IS NULL
  ALTER TABLE solicitudesVenta ADD inspeccionadoEl DATETIME NULL;
GO
IF COL_LENGTH('solicitudesVenta', 'inspector') IS NULL
  ALTER TABLE solicitudesVenta ADD inspector INT NULL;
GO
IF OBJECT_ID('fk_solicitudesVenta_inspector', 'F') IS NULL
  ALTER TABLE solicitudesVenta ADD CONSTRAINT fk_solicitudesVenta_inspector FOREIGN KEY (inspector) REFERENCES empleados (identificador);
GO

-- Devolucion con cargo al usuario (TPO Venta de Articulos).
IF COL_LENGTH('solicitudesVenta', 'gastosDevolucion') IS NULL
  ALTER TABLE solicitudesVenta ADD gastosDevolucion DECIMAL(18,2) NULL;
GO

-- @DOWN
IF COL_LENGTH('solicitudesVenta', 'gastosDevolucion') IS NOT NULL
  ALTER TABLE solicitudesVenta DROP COLUMN gastosDevolucion;
GO
IF OBJECT_ID('fk_solicitudesVenta_inspector', 'F') IS NOT NULL
  ALTER TABLE solicitudesVenta DROP CONSTRAINT fk_solicitudesVenta_inspector;
GO
IF COL_LENGTH('solicitudesVenta', 'inspector') IS NOT NULL
  ALTER TABLE solicitudesVenta DROP COLUMN inspector;
GO
IF COL_LENGTH('solicitudesVenta', 'inspeccionadoEl') IS NOT NULL
  ALTER TABLE solicitudesVenta DROP COLUMN inspeccionadoEl;
GO
IF OBJECT_ID('chkEstadoSolicitud', 'C') IS NOT NULL
  ALTER TABLE solicitudesVenta DROP CONSTRAINT chkEstadoSolicitud;
GO
IF OBJECT_ID('chkEstadoSolicitud', 'C') IS NULL
  ALTER TABLE solicitudesVenta ADD CONSTRAINT chkEstadoSolicitud
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'devuelta'));
GO
