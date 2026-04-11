const sql = require('mssql');
const bcrypt = require('bcrypt');

const config = {
  server: 'localhost',
  user: 'sa',
  password: 'TuContraseña123',
  database: 'subastas',
  port: 1433,
  options: { encrypt: false, trustServerCertificate: true }
};

const schema = `
create table paises(
  numero int not null,
  nombre varchar(250) not null,
  nombreCorto varchar(250) null,
  capital varchar(250) not null,
  nacionalidad varchar(250) not null,
  idiomas varchar(150) not null,
  constraint pk_paises primary key (numero)
);

create table personas(
  identificador int not null identity,
  documento varchar(20) not null,
  nombre varchar(150) not null,
  direccion varchar(250),
  estado varchar(15) constraint chkEstado check (estado in ('activo', 'inactivo')),
  foto varbinary(max),
  constraint pk_personas primary key (identificador)
);

create table empleados(
  identificador int not null,
  cargo varchar(100),
  sector int null,
  constraint pk_empleados primary key (identificador)
);

create table sectores(
  identificador int not null identity,
  nombreSector varchar(150) not null,
  codigoSector varchar(10) null,
  responsableSector int null,
  constraint pk_sectores primary key (identificador),
  constraint fk_sectores_empleados foreign key (responsableSector) references empleados
);

create table seguros(
  nroPoliza varchar(30) not null,
  compania varchar(150) not null,
  polizaCombinada varchar(2) constraint chkpolizaCombinada check(polizaCombinada in ('si','no')),
  importe decimal(18,2) not null constraint chkImporte check (importe > 0),
  constraint pk_seguro primary key (nroPoliza)
);

create table clientes(
  identificador int not null,
  numeroPais int,
  admitido varchar(2) constraint chkAdmitido check(admitido in ('si','no')),
  categoria varchar(10) constraint chkCategoria check (categoria in ('comun', 'especial', 'plata', 'oro', 'platino')),
  verificador int not null,
  constraint pk_clientes primary key (identificador),
  constraint fk_clientes_personas foreign key (identificador) references personas,
  constraint fk_clientes_empleados foreign key (verificador) references empleados (identificador),
  constraint fk_clientes_paises foreign key (numeroPais) references paises (numero)
);

create table duenios(
  identificador int not null,
  numeroPais int,
  verificacionFinanciera varchar(2) constraint chkVF check(verificacionFinanciera in ('si','no')),
  verificacionJudicial varchar(2) constraint chkVJ check(verificacionJudicial in ('si','no')),
  calificacionRiesgo int constraint chkCR check(calificacionRiesgo in (1,2,3,4,5,6)),
  verificador int not null,
  constraint pk_duenios primary key (identificador),
  constraint fk_duenios_personas foreign key (identificador) references personas,
  constraint fk_duenios_empleados foreign key (verificador) references empleados (identificador)
);

create table subastadores(
  identificador int not null,
  matricula varchar(15),
  region varchar(50),
  constraint pk_subastadores primary key (identificador),
  constraint fk_subastadores_personas foreign key (identificador) references personas
);

create table subastas(
  identificador int not null identity,
  fecha date,
  hora time not null,
  estado varchar(10) constraint chkES check (estado in ('abierta','cerrada')),
  subastador int null,
  ubicacion varchar(350) null,
  capacidadAsistentes int null,
  tieneDeposito varchar(2) constraint chkTD check(tieneDeposito in ('si','no')),
  seguridadPropia varchar(2) constraint chkSP check(seguridadPropia in ('si','no')),
  categoria varchar(10) constraint chkCS check (categoria in ('comun', 'especial', 'plata', 'oro', 'platino')),
  constraint pk_subastas primary key (identificador),
  constraint fk_subastas_subastadores foreign key (subastador) references subastadores(identificador)
);

create table productos(
  identificador int not null identity,
  fecha date,
  disponible varchar(2) constraint chkD check (disponible in ('si','no')),
  descripcionCatalogo varchar(500) null default 'No Posee',
  descripcionCompleta varchar(300) not null,
  revisor int not null,
  duenio int not null,
  seguro varchar(30) null,
  constraint pk_productos primary key (identificador),
  constraint fk_productos_empleados foreign key (revisor) references empleados(identificador),
  constraint fk_productos_duenios foreign key (duenio) references duenios(identificador)
);

create table fotos(
  identificador int not null identity,
  producto int not null,
  foto varbinary(max) not null,
  constraint pk_fotos primary key (identificador),
  constraint fk_fotos_productos foreign key (producto) references productos(identificador)
);

create table catalogos(
  identificador int not null identity,
  descripcion varchar(250) not null,
  subasta int null,
  responsable int not null,
  constraint pk_catalogos primary key (identificador),
  constraint fk_catalogos_empleados foreign key (responsable) references empleados(identificador),
  constraint fk_catalogos_subastas foreign key (subasta) references subastas(identificador)
);

create table itemsCatalogo(
  identificador int not null identity,
  catalogo int not null,
  producto int not null,
  precioBase decimal(18,2) not null constraint chkPB check (precioBase > 0.01),
  comision decimal(18,2) not null constraint chkC check (comision > 0.01),
  subastado varchar(2) constraint chkS check (subastado in ('si','no')),
  constraint pk_itemsCatalogo primary key (identificador),
  constraint fk_itemsCatalogo_catalogos foreign key (catalogo) references catalogos,
  constraint fk_itemsCatalogo_productos foreign key (producto) references productos
);

create table asistentes(
  identificador int not null identity,
  numeroPostor int not null,
  cliente int not null,
  subasta int not null,
  constraint pk_asistentes primary key (identificador),
  constraint fk_asistentes_clientes foreign key (cliente) references clientes,
  constraint fk_asistentes_subasta foreign key (subasta) references subastas
);

create table pujos(
  identificador int not null identity,
  asistente int not null,
  item int not null,
  importe decimal(18,2) not null constraint chkI check (importe > 0.01),
  ganador varchar(2) constraint chkG check (ganador in ('si','no')) default 'no',
  constraint pk_pujos primary key (identificador),
  constraint fk_pujos_asistentes foreign key (asistente) references asistentes,
  constraint fk_pujos_itemsCatalogo foreign key (item) references itemsCatalogo
);

create table registroDeSubasta(
  identificador int not null identity,
  subasta int not null,
  duenio int not null,
  producto int not null,
  cliente int not null,
  importe decimal(18,2) not null constraint chkImportePagado check (importe > 0.01),
  comision decimal(18,2) not null constraint chkComisionPagada check (comision > 0.01),
  constraint pk_registroDeSubasta primary key (identificador),
  constraint fk_registroDeSubasta_subastas foreign key (subasta) references subastas,
  constraint fk_registroDeSubasta_duenios foreign key (duenio) references duenios,
  constraint fk_registroDeSubasta_producto foreign key (producto) references productos,
  constraint fk_registroDeSubasta_cliente foreign key (cliente) references clientes
);
`;

async function setup() {
  const pool = await sql.connect(config);
  console.log('Connected to SQL Server');

  // Create base tables one by one
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    try {
      await pool.request().query(stmt);
      const match = stmt.match(/create table (\w+)/i);
      if (match) console.log('Created table:', match[1]);
    } catch (e) {
      if (e.message.includes('already an object')) {
        const match = stmt.match(/create table (\w+)/i);
        console.log('Already exists:', match ? match[1] : '?');
      } else {
        console.error('Error:', e.message.substring(0, 100));
      }
    }
  }

  // Run migration 002: new columns
  const cols = [
    "ALTER TABLE subastas ADD moneda VARCHAR(3) CONSTRAINT chkMoneda CHECK (moneda IN ('ARS', 'USD')) DEFAULT 'ARS'",
    "ALTER TABLE clientes ADD email VARCHAR(250) NULL",
    "ALTER TABLE clientes ADD claveHash VARCHAR(250) NULL",
  ];
  for (const c of cols) {
    try { await pool.request().query(c); console.log('Added column'); } catch(e) {
      if (e.message.includes('already')) console.log('Column already exists');
      else console.error('Col error:', e.message.substring(0, 80));
    }
  }

  // Run migration 003: new tables (read from file)
  const fs = require('fs');
  const path = require('path');
  const mig003 = fs.readFileSync(path.join(__dirname, 'src/migrations/003_nuevas_tablas.sql'), 'utf8');
  const batches = mig003.split(/^GO\s*$/gm).map(b => b.trim()).filter(b => b.length > 0 && !b.startsWith('--'));
  for (const batch of batches) {
    try {
      await pool.request().batch(batch);
      console.log('Migration 003 batch OK');
    } catch(e) {
      if (e.message.includes('already')) console.log('Already exists (003)');
      else console.error('Mig003 error:', e.message.substring(0, 100));
    }
  }

  // Seed data: country + employee + user
  console.log('\n--- Seeding data ---');

  // Argentina
  try {
    await pool.request().query("INSERT INTO paises VALUES (54, 'Argentina', 'AR', 'Buenos Aires', 'Argentino/a', 'Español')");
    console.log('Inserted pais: Argentina');
  } catch(e) { console.log('Pais already exists or error:', e.message.substring(0, 60)); }

  // Persona for employee (verificador)
  try {
    await pool.request().query("SET IDENTITY_INSERT personas ON; INSERT INTO personas (identificador, documento, nombre, direccion, estado) VALUES (1, '00000001', 'Admin Sistema', 'Oficina Central', 'activo'); SET IDENTITY_INSERT personas OFF;");
    console.log('Inserted persona: Admin');
  } catch(e) { console.log('Admin persona:', e.message.substring(0, 60)); }

  // Employee
  try {
    await pool.request().query("INSERT INTO empleados VALUES (1, 'Verificador', NULL)");
    console.log('Inserted empleado: Verificador');
  } catch(e) { console.log('Empleado:', e.message.substring(0, 60)); }

  // Persona for Alvaro
  try {
    await pool.request().query("INSERT INTO personas (documento, nombre, direccion, estado) VALUES ('422281599', 'Alvaro', 'Av. Juan Pablo II', 'activo')");
    console.log('Inserted persona: Alvaro');
  } catch(e) { console.log('Persona Alvaro:', e.message.substring(0, 60)); }

  // Get Alvaro's ID
  const result = await pool.request().query("SELECT identificador FROM personas WHERE documento = '422281599'");
  const alvId = result.recordset[0]?.identificador;
  if (!alvId) { console.error('Could not find Alvaro persona'); process.exit(1); }
  console.log('Alvaro persona ID:', alvId);

  // Cliente
  const hash = await bcrypt.hash('Alvaro123!', 10);
  try {
    await pool.request().query(`INSERT INTO clientes (identificador, numeroPais, admitido, categoria, verificador, email, claveHash) VALUES (${alvId}, 54, 'si', 'comun', 1, 'alvaro@test.com', '${hash}')`);
    console.log('Inserted cliente: Alvaro');
  } catch(e) { console.log('Cliente:', e.message.substring(0, 80)); }

  console.log('\n=== SETUP COMPLETE ===');
  console.log('User: alvaro@test.com');
  console.log('Password: Alvaro123!');

  await pool.close();
}

setup().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
