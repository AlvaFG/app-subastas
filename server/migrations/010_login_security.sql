-- Per-account brute-force protection (BSEC-05): track failed logins and an
-- optional temporary lock window, complementing the per-IP rate limiter.

IF COL_LENGTH('clientes', 'failedAttempts') IS NULL
  ALTER TABLE clientes ADD failedAttempts INT NOT NULL CONSTRAINT df_clientes_failedAttempts DEFAULT 0;
GO
IF COL_LENGTH('clientes', 'lockUntil') IS NULL
  ALTER TABLE clientes ADD lockUntil DATETIME NULL;
GO

-- @DOWN
IF COL_LENGTH('clientes', 'lockUntil') IS NOT NULL
  ALTER TABLE clientes DROP COLUMN lockUntil;
GO
IF OBJECT_ID('df_clientes_failedAttempts', 'D') IS NOT NULL
  ALTER TABLE clientes DROP CONSTRAINT df_clientes_failedAttempts;
GO
IF COL_LENGTH('clientes', 'failedAttempts') IS NOT NULL
  ALTER TABLE clientes DROP COLUMN failedAttempts;
GO
