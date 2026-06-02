-- A4-W2: persistir nombre y apellido por separado. La UI y la API ya los
-- manejan separados, pero el backend los concatenaba en personas.nombre.

IF COL_LENGTH('personas', 'apellido') IS NULL
  ALTER TABLE personas ADD apellido varchar(150) NULL;
GO

-- Back-fill best-effort SOLO para clientes (no empleados/duenios/subastadores, cuyo
-- "nombre" puede ser una razon social). Separa la primera palabra como nombre y el
-- resto como apellido. Fragil con apellidos compuestos: es una estimacion inicial.
UPDATE p
  SET p.apellido = LTRIM(SUBSTRING(p.nombre, CHARINDEX(' ', p.nombre) + 1, LEN(p.nombre))),
      p.nombre = LEFT(p.nombre, CHARINDEX(' ', p.nombre) - 1)
FROM personas p
INNER JOIN clientes c ON c.identificador = p.identificador
WHERE p.apellido IS NULL AND CHARINDEX(' ', p.nombre) > 0;
GO

-- @DOWN
IF COL_LENGTH('personas', 'apellido') IS NOT NULL
  ALTER TABLE personas DROP COLUMN apellido;
GO
