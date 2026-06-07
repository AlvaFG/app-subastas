-- Token de activacion de cuenta (registro etapa 2). Cuando la empresa admite a un
-- cliente (etapa 1), se genera un token de un solo uso que viaja en el mail de
-- admision; la etapa 2 lo valida para que el cliente cree su clave. Se guarda el
-- hash (SHA-256, 64 hex) — nunca el token en claro — con una ventana de validez.

IF COL_LENGTH('clientes', 'activacionTokenHash') IS NULL
  ALTER TABLE clientes ADD activacionTokenHash CHAR(64) NULL;
GO
IF COL_LENGTH('clientes', 'activacionTokenExpira') IS NULL
  ALTER TABLE clientes ADD activacionTokenExpira DATETIME NULL;
GO

-- @DOWN
IF COL_LENGTH('clientes', 'activacionTokenExpira') IS NOT NULL
  ALTER TABLE clientes DROP COLUMN activacionTokenExpira;
GO
IF COL_LENGTH('clientes', 'activacionTokenHash') IS NOT NULL
  ALTER TABLE clientes DROP COLUMN activacionTokenHash;
GO
