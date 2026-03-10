-- Migration 001: Correccion de typos en schema existente
-- UP

-- Fix 'incativo' -> 'inactivo' en personas.estado (linea 16)
ALTER TABLE personas DROP CONSTRAINT chkEstado;
ALTER TABLE personas ADD CONSTRAINT chkEstado CHECK (estado IN ('activo', 'inactivo'));
GO

-- Fix 'carrada' -> 'cerrada' en subastas.estado (linea 88)
ALTER TABLE subastas DROP CONSTRAINT chkES;
ALTER TABLE subastas ADD CONSTRAINT chkES CHECK (estado IN ('abierta', 'cerrada'));
GO

-- Nota: El typo del punto en linea 40 (seguros.nroPoliza) es un error de sintaxis
-- que impide la creacion de la tabla. Si la tabla ya existe, no requiere fix.
-- Si se necesita recrear, usar 002_nuevas_tablas.sql

-- DOWN (rollback)
-- ALTER TABLE personas DROP CONSTRAINT chkEstado;
-- ALTER TABLE personas ADD CONSTRAINT chkEstado CHECK (estado IN ('activo', 'incativo'));
-- ALTER TABLE subastas DROP CONSTRAINT chkES;
-- ALTER TABLE subastas ADD CONSTRAINT chkES CHECK (estado IN ('abierta', 'carrada'));
