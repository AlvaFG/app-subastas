-- Persist the registrant's ID document photos (REQ-02 / BSEC-03).
-- Stores Cloudinary URLs when configured, otherwise the raw image bytes as
-- a fallback so the verification requirement is never silently dropped.

IF OBJECT_ID('documentosCliente', 'U') IS NULL
CREATE TABLE documentosCliente (
  identificador INT NOT NULL IDENTITY,
  cliente INT NOT NULL,
  urlFrente NVARCHAR(500) NULL,
  urlDorso NVARCHAR(500) NULL,
  fotoFrente VARBINARY(MAX) NULL,
  fotoDorso VARBINARY(MAX) NULL,
  fechaCarga DATETIME NOT NULL DEFAULT GETDATE(),
  CONSTRAINT pk_documentosCliente PRIMARY KEY (identificador),
  CONSTRAINT fk_documentosCliente_clientes FOREIGN KEY (cliente) REFERENCES clientes (identificador)
);
GO

-- @DOWN
IF OBJECT_ID('documentosCliente', 'U') IS NOT NULL DROP TABLE documentosCliente;
GO
