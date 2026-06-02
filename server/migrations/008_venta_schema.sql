-- Sale-request schema, promoted from runtime DDL (ensureVentaSchema) to a
-- versioned migration (DB-10). The controller still keeps an idempotent guard
-- as a dev safety net, but production schema is owned here.

IF COL_LENGTH('solicitudesVenta', 'moneda') IS NULL
  ALTER TABLE solicitudesVenta ADD moneda VARCHAR(3) NULL;
GO
IF COL_LENGTH('solicitudesVenta', 'horaSubasta') IS NULL
  ALTER TABLE solicitudesVenta ADD horaSubasta TIME NULL;
GO
IF COL_LENGTH('solicitudesVenta', 'esObraDisenador') IS NULL
  ALTER TABLE solicitudesVenta ADD esObraDisenador VARCHAR(2) NULL;
GO
IF COL_LENGTH('solicitudesVenta', 'nombreArtistaDisenador') IS NULL
  ALTER TABLE solicitudesVenta ADD nombreArtistaDisenador VARCHAR(250) NULL;
GO
IF COL_LENGTH('solicitudesVenta', 'fechaObjeto') IS NULL
  ALTER TABLE solicitudesVenta ADD fechaObjeto DATE NULL;
GO
IF COL_LENGTH('solicitudesVenta', 'historiaObjeto') IS NULL
  ALTER TABLE solicitudesVenta ADD historiaObjeto VARCHAR(2000) NULL;
GO
IF COL_LENGTH('productos', 'esObraDisenador') IS NULL
  ALTER TABLE productos ADD esObraDisenador VARCHAR(2) NULL;
GO
IF COL_LENGTH('productos', 'nombreArtistaDisenador') IS NULL
  ALTER TABLE productos ADD nombreArtistaDisenador VARCHAR(250) NULL;
GO
IF COL_LENGTH('productos', 'fechaObjeto') IS NULL
  ALTER TABLE productos ADD fechaObjeto DATE NULL;
GO
IF COL_LENGTH('productos', 'historiaObjeto') IS NULL
  ALTER TABLE productos ADD historiaObjeto VARCHAR(2000) NULL;
GO

IF OBJECT_ID('solicitudFotos', 'U') IS NULL
CREATE TABLE solicitudFotos (
  identificador INT NOT NULL IDENTITY,
  solicitud INT NOT NULL,
  foto VARBINARY(MAX) NOT NULL,
  CONSTRAINT pk_solicitudFotos PRIMARY KEY (identificador),
  CONSTRAINT fk_solicitudFotos_solicitudesVenta FOREIGN KEY (solicitud) REFERENCES solicitudesVenta(identificador)
);
GO
IF OBJECT_ID('solicitudArticulos', 'U') IS NULL
CREATE TABLE solicitudArticulos (
  identificador INT NOT NULL IDENTITY,
  solicitud INT NOT NULL,
  orden INT NOT NULL,
  descripcion VARCHAR(1000) NOT NULL,
  CONSTRAINT pk_solicitudArticulos PRIMARY KEY (identificador),
  CONSTRAINT fk_solicitudArticulos_solicitudesVenta FOREIGN KEY (solicitud) REFERENCES solicitudesVenta(identificador)
);
GO
IF OBJECT_ID('solicitudArticuloFotos', 'U') IS NULL
CREATE TABLE solicitudArticuloFotos (
  identificador INT NOT NULL IDENTITY,
  articulo INT NOT NULL,
  foto VARBINARY(MAX) NOT NULL,
  CONSTRAINT pk_solicitudArticuloFotos PRIMARY KEY (identificador),
  CONSTRAINT fk_solicitudArticuloFotos_solicitudArticulos FOREIGN KEY (articulo) REFERENCES solicitudArticulos(identificador)
);
GO
IF OBJECT_ID('productoArticulos', 'U') IS NULL
CREATE TABLE productoArticulos (
  identificador INT NOT NULL IDENTITY,
  producto INT NOT NULL,
  orden INT NOT NULL,
  descripcion VARCHAR(1000) NOT NULL,
  CONSTRAINT pk_productoArticulos PRIMARY KEY (identificador),
  CONSTRAINT fk_productoArticulos_productos FOREIGN KEY (producto) REFERENCES productos(identificador)
);
GO
IF OBJECT_ID('productoArticuloFotos', 'U') IS NULL
CREATE TABLE productoArticuloFotos (
  identificador INT NOT NULL IDENTITY,
  articulo INT NOT NULL,
  foto VARBINARY(MAX) NOT NULL,
  CONSTRAINT pk_productoArticuloFotos PRIMARY KEY (identificador),
  CONSTRAINT fk_productoArticuloFotos_productoArticulos FOREIGN KEY (articulo) REFERENCES productoArticulos(identificador)
);
GO

-- @DOWN
IF OBJECT_ID('productoArticuloFotos', 'U') IS NOT NULL DROP TABLE productoArticuloFotos;
GO
IF OBJECT_ID('productoArticulos', 'U') IS NOT NULL DROP TABLE productoArticulos;
GO
IF OBJECT_ID('solicitudArticuloFotos', 'U') IS NOT NULL DROP TABLE solicitudArticuloFotos;
GO
IF OBJECT_ID('solicitudArticulos', 'U') IS NOT NULL DROP TABLE solicitudArticulos;
GO
IF OBJECT_ID('solicitudFotos', 'U') IS NOT NULL DROP TABLE solicitudFotos;
GO
