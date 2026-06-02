-- Close referential-integrity gap on productos.seguro (DB-13).
-- WITH NOCHECK enforces the FK for new/updated rows without rejecting any
-- pre-existing legacy rows during the migration.

IF OBJECT_ID('fk_productos_seguros', 'F') IS NULL AND COL_LENGTH('productos', 'seguro') IS NOT NULL
BEGIN
  ALTER TABLE productos WITH NOCHECK
    ADD CONSTRAINT fk_productos_seguros FOREIGN KEY (seguro) REFERENCES seguros (nroPoliza);
END
GO

-- @DOWN
IF OBJECT_ID('fk_productos_seguros', 'F') IS NOT NULL
  ALTER TABLE productos DROP CONSTRAINT fk_productos_seguros;
GO
