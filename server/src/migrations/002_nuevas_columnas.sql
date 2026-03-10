-- Migration 002: Agregar columnas faltantes al schema existente
-- UP

-- Moneda en subastas (pesos o dolares)
ALTER TABLE subastas ADD moneda VARCHAR(3) CONSTRAINT chkMoneda CHECK (moneda IN ('ARS', 'USD')) DEFAULT 'ARS';
GO

-- Email y clave para clientes (registro etapa 2)
ALTER TABLE clientes ADD email VARCHAR(250) NULL;
ALTER TABLE clientes ADD claveHash VARCHAR(250) NULL;
GO

-- DOWN
-- ALTER TABLE subastas DROP CONSTRAINT chkMoneda;
-- ALTER TABLE subastas DROP COLUMN moneda;
-- ALTER TABLE clientes DROP COLUMN email;
-- ALTER TABLE clientes DROP COLUMN claveHash;
