-- Migration: Add moneda field to multas table
-- This allows tracking which currency the penalty is in

IF NOT EXISTS(
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME='multas' AND COLUMN_NAME='moneda'
)
BEGIN
  ALTER TABLE multas
  ADD moneda VARCHAR(3) DEFAULT 'ARS';
  
  PRINT 'Column moneda added to multas table';
END
ELSE
BEGIN
  PRINT 'Column moneda already exists in multas table';
END
