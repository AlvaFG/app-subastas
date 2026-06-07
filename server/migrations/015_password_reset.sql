-- Password recovery (recupero de clave): single-use reset token per cliente.
-- We store the SHA-256 *hash* of the token (64 hex chars), never the raw token,
-- so a DB leak can't be replayed. resetTokenExpira bounds the validity window.

IF COL_LENGTH('clientes', 'resetTokenHash') IS NULL
  ALTER TABLE clientes ADD resetTokenHash CHAR(64) NULL;
GO
IF COL_LENGTH('clientes', 'resetTokenExpira') IS NULL
  ALTER TABLE clientes ADD resetTokenExpira DATETIME NULL;
GO

-- @DOWN
IF COL_LENGTH('clientes', 'resetTokenExpira') IS NOT NULL
  ALTER TABLE clientes DROP COLUMN resetTokenExpira;
GO
IF COL_LENGTH('clientes', 'resetTokenHash') IS NOT NULL
  ALTER TABLE clientes DROP COLUMN resetTokenHash;
GO
