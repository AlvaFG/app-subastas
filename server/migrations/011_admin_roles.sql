-- Capa administrativa (A5/A6/A7/A9): autenticacion y rol de empleado + auditoria.
-- Los empleados ya existen en la tabla `empleados` (heredan de personas) pero no
-- podian autenticarse: agregamos email/claveHash/rol. Tambien columnas de auditoria
-- para saber QUIEN admitio a un cliente y QUIEN verifico un medio de pago.

-- Credenciales y rol de empleado
IF COL_LENGTH('empleados', 'email') IS NULL
  ALTER TABLE empleados ADD email varchar(250) NULL;
GO
IF COL_LENGTH('empleados', 'claveHash') IS NULL
  ALTER TABLE empleados ADD claveHash varchar(250) NULL;
GO
-- `rol` acotado (cargo queda como texto libre legacy). Default 'operador' para filas existentes.
IF COL_LENGTH('empleados', 'rol') IS NULL
  ALTER TABLE empleados ADD rol varchar(15) NOT NULL
    CONSTRAINT df_empleados_rol DEFAULT 'operador'
    CONSTRAINT chk_empleados_rol CHECK (rol IN ('operador','supervisor','admin'));
GO

-- Auditoria de admision de clientes (A5)
IF COL_LENGTH('clientes', 'admitidoPor') IS NULL
  ALTER TABLE clientes ADD admitidoPor INT NULL;
GO
IF COL_LENGTH('clientes', 'fechaAprobacion') IS NULL
  ALTER TABLE clientes ADD fechaAprobacion DATETIME NULL;
GO

-- Auditoria de verificacion de medios de pago (A6)
IF COL_LENGTH('mediosDePago', 'verificadorId') IS NULL
  ALTER TABLE mediosDePago ADD verificadorId INT NULL;
GO

-- Integridad referencial de las columnas de auditoria (apuntan a empleados).
IF OBJECT_ID('fk_clientes_admitidoPor', 'F') IS NULL
  ALTER TABLE clientes ADD CONSTRAINT fk_clientes_admitidoPor FOREIGN KEY (admitidoPor) REFERENCES empleados (identificador);
GO
IF OBJECT_ID('fk_mediosDePago_verificador', 'F') IS NULL
  ALTER TABLE mediosDePago ADD CONSTRAINT fk_mediosDePago_verificador FOREIGN KEY (verificadorId) REFERENCES empleados (identificador);
GO

-- Seed: empleado administrador para demo/operacion.
-- Password demo: 'Admin1234' (hash bcrypt precomputado, cost 10). Idempotente por documento.
IF NOT EXISTS (SELECT 1 FROM personas WHERE documento = 'ADMIN-0001')
  INSERT INTO personas (documento, nombre, direccion, estado)
  VALUES ('ADMIN-0001', 'Administrador Sistema', 'Oficina Central', 'activo');
GO
IF NOT EXISTS (
  SELECT 1 FROM empleados e
  INNER JOIN personas p ON p.identificador = e.identificador
  WHERE p.documento = 'ADMIN-0001')
  INSERT INTO empleados (identificador, cargo, sector, email, claveHash, rol)
  SELECT p.identificador, 'Administrador', NULL,
         'admin@subastas.com',
         '$2b$10$oMPisXcJyPSVbslVM4MBA.BnBGzxHctFQ8caCgNvNH2LhKlaPI.Be',
         'admin'
  FROM personas p WHERE p.documento = 'ADMIN-0001';
GO
-- Completar credenciales si el empleado ya existia sin ellas.
UPDATE e
  SET e.email = 'admin@subastas.com',
      e.claveHash = '$2b$10$oMPisXcJyPSVbslVM4MBA.BnBGzxHctFQ8caCgNvNH2LhKlaPI.Be',
      e.rol = 'admin'
FROM empleados e
INNER JOIN personas p ON p.identificador = e.identificador
WHERE p.documento = 'ADMIN-0001' AND (e.email IS NULL OR e.claveHash IS NULL);
GO

-- @DOWN
DELETE e FROM empleados e INNER JOIN personas p ON p.identificador = e.identificador WHERE p.documento = 'ADMIN-0001';
GO
DELETE FROM personas WHERE documento = 'ADMIN-0001';
GO
IF OBJECT_ID('fk_mediosDePago_verificador', 'F') IS NOT NULL ALTER TABLE mediosDePago DROP CONSTRAINT fk_mediosDePago_verificador;
GO
IF COL_LENGTH('mediosDePago', 'verificadorId') IS NOT NULL ALTER TABLE mediosDePago DROP COLUMN verificadorId;
GO
IF COL_LENGTH('clientes', 'fechaAprobacion') IS NOT NULL ALTER TABLE clientes DROP COLUMN fechaAprobacion;
GO
IF OBJECT_ID('fk_clientes_admitidoPor', 'F') IS NOT NULL ALTER TABLE clientes DROP CONSTRAINT fk_clientes_admitidoPor;
GO
IF COL_LENGTH('clientes', 'admitidoPor') IS NOT NULL ALTER TABLE clientes DROP COLUMN admitidoPor;
GO
IF OBJECT_ID('chk_empleados_rol', 'C') IS NOT NULL ALTER TABLE empleados DROP CONSTRAINT chk_empleados_rol;
GO
IF OBJECT_ID('df_empleados_rol', 'D') IS NOT NULL ALTER TABLE empleados DROP CONSTRAINT df_empleados_rol;
GO
IF COL_LENGTH('empleados', 'rol') IS NOT NULL ALTER TABLE empleados DROP COLUMN rol;
GO
IF COL_LENGTH('empleados', 'claveHash') IS NOT NULL ALTER TABLE empleados DROP COLUMN claveHash;
GO
IF COL_LENGTH('empleados', 'email') IS NOT NULL ALTER TABLE empleados DROP COLUMN email;
GO
