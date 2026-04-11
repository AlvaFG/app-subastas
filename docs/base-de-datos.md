# Base de Datos

## Diagrama de Relaciones

```
paises ─────────────┐
                     │ numeroPais
personas ───┬───── clientes ──────── asistentes ──── pujos
            │        │ verificador      │ subasta       │ item
            │        ├──────────── empleados            │
            │        │                  │ sector        │
            ├───── duenios ──┐      sectores           │
            │        │       │                          │
            └───── subastadores    productos ────── itemsCatalogo
                     │               │  │               │
                  subastas ──── catalogos ──────────────┘
                     │               │
              registroDeSubasta    fotos

              seguros (nroPoliza referenciado por productos.seguro)

--- Tablas nuevas (migraciones) ---

clientes ──── mediosDePago
clientes ──── sesiones
clientes ──── notificaciones
clientes ──── multas
clientes ──── solicitudesVenta
              depositos (standalone)
duenios ───── cuentasAVista
```

## Tablas Originales (16)

### paises
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| numero | int | PK | | Codigo del pais |
| nombre | varchar(250) | | | Nombre completo |
| nombreCorto | varchar(250) | | | Abreviatura (nullable) |
| capital | varchar(250) | | | Capital |
| nacionalidad | varchar(250) | | | Gentilicio |
| idiomas | varchar(150) | | | Idiomas oficiales |

### personas
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID autoincremental |
| documento | varchar(20) | | | Numero de documento |
| nombre | varchar(150) | | | Nombre completo |
| direccion | varchar(250) | | | Domicilio legal |
| estado | varchar(15) | | | 'activo' o 'inactivo' |
| foto | varbinary(max) | | | Foto documento |

### empleados
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int | PK | FK -> personas | Hereda de personas |
| cargo | varchar(100) | | | Cargo en la empresa |
| sector | int | | FK -> sectores | Sector asignado |

### sectores
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID sector |
| nombreSector | varchar(150) | | | Nombre |
| codigoSector | varchar(10) | | | Codigo interno |
| responsableSector | int | | FK -> empleados | Jefe del sector |

### seguros
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| nroPoliza | varchar(30) | PK | | Numero de poliza |
| compania | varchar(150) | | | Compania aseguradora |
| polizaCombinada | varchar(2) | | | 'si'/'no' - cubre multiples piezas |
| importe | decimal(18,2) | | | Monto asegurado (> 0) |

### clientes
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int | PK | FK -> personas | Hereda de personas |
| numeroPais | int | | FK -> paises | Pais de origen |
| admitido | varchar(2) | | | 'si'/'no' |
| categoria | varchar(10) | | | comun/especial/plata/oro/platino |
| verificador | int | | FK -> empleados | Empleado que verifico |
| email | varchar(250) | | | *(migracion 002)* Email del usuario |
| claveHash | varchar(250) | | | *(migracion 002)* Password hasheada |

### duenios
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int | PK | FK -> personas | Hereda de personas |
| numeroPais | int | | | Pais |
| verificacionFinanciera | varchar(2) | | | 'si'/'no' |
| verificacionJudicial | varchar(2) | | | 'si'/'no' |
| calificacionRiesgo | int | | | 1 a 6 |
| verificador | int | | FK -> empleados | Empleado verificador |

### subastadores
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int | PK | FK -> personas | Hereda de personas |
| matricula | varchar(15) | | | Matricula profesional |
| region | varchar(50) | | | Region asignada |

### subastas
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID subasta |
| fecha | date | | | Fecha (> 10 dias desde creacion) |
| hora | time | | | Hora de inicio |
| estado | varchar(10) | | | 'abierta'/'cerrada' |
| subastador | int | | FK -> subastadores | Rematador asignado |
| ubicacion | varchar(350) | | | Direccion del evento |
| capacidadAsistentes | int | | | Capacidad maxima |
| tieneDeposito | varchar(2) | | | 'si'/'no' |
| seguridadPropia | varchar(2) | | | 'si'/'no' |
| categoria | varchar(10) | | | comun/especial/plata/oro/platino |
| moneda | varchar(3) | | | *(migracion 002)* 'ARS'/'USD' |

### productos
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID producto |
| fecha | date | | | Fecha de ingreso |
| disponible | varchar(2) | | | 'si'/'no' |
| descripcionCatalogo | varchar(500) | | | Texto breve (default 'No Posee') |
| descripcionCompleta | varchar(300) | | | URL a PDF con descripcion completa |
| revisor | int | | FK -> empleados | Empleado que reviso |
| duenio | int | | FK -> duenios | Propietario actual |
| seguro | varchar(30) | | FK -> seguros | Poliza asociada |

### fotos
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID foto |
| producto | int | | FK -> productos | Producto asociado |
| foto | varbinary(max) | | | Imagen binaria |

### catalogos
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID catalogo |
| descripcion | varchar(250) | | | Nombre del catalogo |
| subasta | int | | FK -> subastas | Subasta asociada |
| responsable | int | | FK -> empleados | Responsable |

### itemsCatalogo
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID item |
| catalogo | int | | FK -> catalogos | Catalogo al que pertenece |
| producto | int | | FK -> productos | Producto asociado |
| precioBase | decimal(18,2) | | | Precio base (> 0.01) |
| comision | decimal(18,2) | | | Comision (> 0.01) |
| subastado | varchar(2) | | | 'si'/'no' |

### asistentes
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID asistente |
| numeroPostor | int | | | Numero asignado |
| cliente | int | | FK -> clientes | Cliente postor |
| subasta | int | | FK -> subastas | Subasta a la que asiste |

### pujos
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID puja |
| asistente | int | | FK -> asistentes | Quien puja |
| item | int | | FK -> itemsCatalogo | Item por el que se puja |
| importe | decimal(18,2) | | | Monto ofertado (> 0.01) |
| ganador | varchar(2) | | | 'si'/'no' (default 'no') |

### registroDeSubasta
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID registro |
| subasta | int | | FK -> subastas | Subasta |
| duenio | int | | FK -> duenios | Dueno anterior |
| producto | int | | FK -> productos | Producto vendido |
| cliente | int | | FK -> clientes | Comprador |
| importe | decimal(18,2) | | | Importe pagado (> 0.01) |
| comision | decimal(18,2) | | | Comision cobrada (> 0.01) |

---

## Tablas Nuevas (7) — Migracion 003

### mediosDePago
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID |
| cliente | int | | FK -> clientes | Propietario |
| tipo | varchar(20) | | | cuenta_bancaria/tarjeta_credito/cheque_certificado |
| descripcion | varchar(250) | | | Nombre descriptivo |
| banco | varchar(150) | | | Entidad bancaria |
| numeroCuenta | varchar(30) | | | Numero de cuenta |
| cbu | varchar(25) | | | CBU/IBAN |
| moneda | varchar(3) | | | ARS/USD |
| ultimosDigitos | varchar(4) | | | Ultimos 4 digitos (tarjeta) |
| montoCheque | decimal(18,2) | | | Monto total del cheque |
| montoDisponible | decimal(18,2) | | | Saldo disponible |
| verificado | varchar(2) | | | 'si'/'no' |
| activo | varchar(2) | | | 'si'/'no' (soft delete) |

### sesiones
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID |
| cliente | int | | FK -> clientes | Usuario |
| refreshToken | varchar(500) | | | Token de refresh |
| fechaExpiracion | datetime | | | Expiracion (default +7 dias) |
| activo | varchar(2) | | | 'si'/'no' |

### notificaciones
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID |
| cliente | int | | FK -> clientes | Destinatario |
| tipo | varchar(20) | | | ganador/multa/inspeccion/pago/sistema |
| titulo | varchar(250) | | | Titulo |
| mensaje | varchar(1000) | | | Contenido |
| leida | varchar(2) | | | 'si'/'no' |
| fecha | datetime | | | Fecha de creacion |

### multas
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID |
| cliente | int | | FK -> clientes | Usuario multado |
| importeOriginal | decimal(18,2) | | | Importe de la puja no pagada |
| importeMulta | decimal(18,2) | | | 10% del importe original |
| fechaLimite | datetime | | | Deadline (+72 horas) |
| derivadaJusticia | varchar(2) | | | 'si'/'no' |

### solicitudesVenta
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID |
| cliente | int | | FK -> clientes | Solicitante |
| descripcion | varchar(1000) | | | Descripcion del bien |
| declaracionPropiedad | varchar(2) | | | 'si'/'no' obligatorio |
| estado | varchar(20) | | | pendiente/aceptada/rechazada/devuelta |
| valorBase | decimal(18,2) | | | Valor base propuesto por empresa |
| comisionPropuesta | decimal(18,2) | | | Comision propuesta |
| motivoRechazo | varchar(500) | | | Motivo si es rechazada |
| aceptadoPorUsuario | varchar(2) | | | 'si'/'no' (respuesta del usuario) |
| fechaSolicitud | datetime | | | Fecha de creacion |

### depositos
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID |
| nombre | varchar(150) | | | Nombre del deposito |
| direccion | varchar(350) | | | Ubicacion |

### cuentasAVista
| Columna | Tipo | PK | FK | Descripcion |
|---------|------|----|----|-------------|
| identificador | int identity | PK | | ID |
| duenio | int | | FK -> duenios | Propietario |
| banco | varchar(150) | | | Banco |
| numeroCuenta | varchar(30) | | | Numero de cuenta |
| cbu | varchar(25) | | | CBU/IBAN |
| moneda | varchar(3) | | | ARS/USD |
| pais | varchar(100) | | | Pais del banco |
| activa | varchar(2) | | | 'si'/'no' |

---

## Migraciones

### 001_fix_typos.sql

Corrige errores de tipeo en el schema original:

```sql
-- Corregir 'incativo' -> 'inactivo' en personas.estado
ALTER TABLE personas DROP CONSTRAINT chkEstado;
ALTER TABLE personas ADD CONSTRAINT chkEstado CHECK (estado IN ('activo', 'inactivo'));

-- Corregir 'carrada' -> 'cerrada' en subastas.estado
ALTER TABLE subastas DROP CONSTRAINT chkES;
ALTER TABLE subastas ADD CONSTRAINT chkES CHECK (estado IN ('abierta', 'cerrada'));
```

### 002_nuevas_columnas.sql

Agrega columnas requeridas por la app:

```sql
ALTER TABLE subastas ADD moneda VARCHAR(3) DEFAULT 'ARS'
  CONSTRAINT chkMoneda CHECK (moneda IN ('ARS', 'USD'));

ALTER TABLE clientes ADD email VARCHAR(250);
ALTER TABLE clientes ADD claveHash VARCHAR(250);
```

### 003_nuevas_tablas.sql

Crea las 7 tablas nuevas documentadas arriba: mediosDePago, sesiones, notificaciones, multas, solicitudesVenta, depositos, cuentasAVista.
