-- Add moneda field to multas table (DB-03)
-- Lets penalties be tracked/paid in the auction's currency.

IF COL_LENGTH('multas', 'moneda') IS NULL
  ALTER TABLE multas ADD moneda VARCHAR(3) CONSTRAINT chkMonedaMulta CHECK (moneda IN ('ARS', 'USD')) DEFAULT 'ARS';
GO

-- @DOWN
IF OBJECT_ID('chkMonedaMulta', 'C') IS NOT NULL
  ALTER TABLE multas DROP CONSTRAINT chkMonedaMulta;
GO
IF COL_LENGTH('multas', 'moneda') IS NOT NULL
  ALTER TABLE multas DROP COLUMN moneda;
GO
