-- Indexes + uniqueness for hot-path lookups (DB-06/07/08/09).
-- clientes.email: looked up on every login; also dedupes accounts.
IF INDEXPROPERTY(OBJECT_ID('clientes'), 'ux_clientes_email', 'IndexID') IS NULL
  CREATE UNIQUE INDEX ux_clientes_email ON clientes(email) WHERE email IS NOT NULL;
GO
-- pujos.item: read on every bid in the live auction hot-path.
IF INDEXPROPERTY(OBJECT_ID('pujos'), 'ix_pujos_item', 'IndexID') IS NULL
  CREATE INDEX ix_pujos_item ON pujos(item);
GO
-- mediosDePago.cliente: listed/validated repeatedly per client.
IF INDEXPROPERTY(OBJECT_ID('mediosDePago'), 'ix_mediosDePago_cliente', 'IndexID') IS NULL
  CREATE INDEX ix_mediosDePago_cliente ON mediosDePago(cliente);
GO
-- A client attends an auction at most once; postor number is unique per auction.
IF INDEXPROPERTY(OBJECT_ID('asistentes'), 'ux_asistentes_cliente_subasta', 'IndexID') IS NULL
  CREATE UNIQUE INDEX ux_asistentes_cliente_subasta ON asistentes(cliente, subasta);
GO
IF INDEXPROPERTY(OBJECT_ID('asistentes'), 'ux_asistentes_subasta_postor', 'IndexID') IS NULL
  CREATE UNIQUE INDEX ux_asistentes_subasta_postor ON asistentes(subasta, numeroPostor);
GO

-- @DOWN
IF INDEXPROPERTY(OBJECT_ID('clientes'), 'ux_clientes_email', 'IndexID') IS NOT NULL DROP INDEX ux_clientes_email ON clientes;
GO
IF INDEXPROPERTY(OBJECT_ID('pujos'), 'ix_pujos_item', 'IndexID') IS NOT NULL DROP INDEX ix_pujos_item ON pujos;
GO
IF INDEXPROPERTY(OBJECT_ID('mediosDePago'), 'ix_mediosDePago_cliente', 'IndexID') IS NOT NULL DROP INDEX ix_mediosDePago_cliente ON mediosDePago;
GO
IF INDEXPROPERTY(OBJECT_ID('asistentes'), 'ux_asistentes_cliente_subasta', 'IndexID') IS NOT NULL DROP INDEX ux_asistentes_cliente_subasta ON asistentes;
GO
IF INDEXPROPERTY(OBJECT_ID('asistentes'), 'ux_asistentes_subasta_postor', 'IndexID') IS NOT NULL DROP INDEX ux_asistentes_subasta_postor ON asistentes;
GO
