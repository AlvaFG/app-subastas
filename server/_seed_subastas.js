// Seed de subastas de demostración — ALINEADO con el flujo real (confirmarVenta).
// Replica: 1 subasta = 1 producto = 1 item.
//   categoria = resolveAuctionCategoryByPriceBase(precioBase, moneda)
//   comision  = precioBase * 0.1
// Crea/reutiliza 1 subastador y 1 dueño (separado del usuario, para poder ofertar).
const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'subastas',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: { encrypt: process.env.DB_ENCRYPT !== 'false', trustServerCertificate: true },
};

// --- Fórmula precio->categoria (copiada de server/src/utils/category.ts) ---
const USD_TO_ARS_RATE = 1400;
function normalizePriceBaseToArs(precioBase, moneda) {
  if (!Number.isFinite(precioBase) || precioBase <= 0) return 0;
  return moneda === 'USD' ? precioBase * USD_TO_ARS_RATE : precioBase;
}
function resolveAuctionCategoryByPriceBase(precioBase, moneda) {
  const ars = normalizePriceBaseToArs(precioBase, moneda);
  if (ars <= 0) return 'comun';
  if (ars <= 5000) return 'comun';
  if (ars <= 20000) return 'especial';
  if (ars <= 50000) return 'plata';
  if (ars <= 100000) return 'oro';
  return 'platino';
}

// JPEG 1x1 válido (placeholder)
const PHOTO = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD/2Q==',
  'base64');

function dateInDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Productos demo. Cada uno => 1 subasta. La categoría se DERIVA del precioBase.
// Precios elegidos para cubrir las 5 bandas de la fórmula.
const PRODUCTOS = [
  // comun  (ARS <= 5000)
  { cat: 'Reloj de bolsillo de plata, 1910', full: 'Reloj Longines en caja de plata 800, funcionando, con leontina original.', precioBase: 3500, moneda: 'ARS', dias: 20, hora: '18:00:00', ubic: 'Salón Central, Av. Corrientes 1234, CABA' },
  { cat: 'Vinilo - Sui Generis "Vida" 1972', full: 'Disco original primera edición, vinilo grado VG+.', precioBase: 4200, moneda: 'ARS', dias: 22, hora: '19:30:00', ubic: 'Galería del Mercado, San Telmo' },
  { cat: 'Martín Fierro - Edición ilustrada 1962', full: 'Ilustraciones de Castagnino, encuadernación en cuero.', precioBase: 2500, moneda: 'ARS', dias: 24, hora: '17:00:00', ubic: 'Centro Cultural Recoleta' },
  // especial (5000 < ARS <= 20000)
  { cat: 'Óleo sobre tela, paisaje pampeano', full: 'Obra firmada y fechada 1978, enmarcada en madera tallada.', precioBase: 12000, moneda: 'ARS', dias: 21, hora: '20:00:00', ubic: 'Hotel Alvear, Recoleta' },
  { cat: 'Escultura en bronce, 45cm', full: 'Bronce patinado con base de mármol.', precioBase: 18000, moneda: 'ARS', dias: 26, hora: '20:30:00', ubic: 'Hotel Alvear, Recoleta' },
  // plata (20000 < ARS <= 50000)
  { cat: 'Vajilla de porcelana Limoges, 1920', full: 'Juego completo 48 piezas, filo de oro, sin cascaduras.', precioBase: 35000, moneda: 'ARS', dias: 23, hora: '18:30:00', ubic: 'Salón Imperial, Av. Callao' },
  { cat: 'Anillo de oro 18k con esmeralda', full: 'Oro amarillo 18k con esmeralda colombiana 2.1ct y diamantes.', precioBase: 30, moneda: 'USD', dias: 28, hora: '21:00:00', ubic: 'Puerto Madero, Salón VIP' }, // 30*1400=42000 -> plata
  // oro (50000 < ARS <= 100000)
  { cat: 'Reloj Rolex Datejust acero/oro', full: 'Caja 36mm, dial champagne, con caja y papeles.', precioBase: 75000, moneda: 'ARS', dias: 27, hora: '20:00:00', ubic: 'Puerto Madero, Salón VIP' },
  { cat: 'Pintura impresionista firmada', full: 'Óleo de pequeño formato, escuela rioplatense, c.1950.', precioBase: 60, moneda: 'USD', dias: 30, hora: '19:00:00', ubic: 'Hotel Alvear, Recoleta' }, // 60*1400=84000 -> oro
  // platino (ARS > 100000)
  { cat: 'Automóvil clásico Mercedes 280SL 1969', full: 'Pagoda restaurada, motor original, documentación completa.', precioBase: 250000, moneda: 'ARS', dias: 25, hora: '17:30:00', ubic: 'Autódromo, Pabellón de Clásicos' },
  { cat: 'Collar de diamantes Art Déco', full: 'Platino con diamantes talla antigua, ~12ct totales, certificado.', precioBase: 200, moneda: 'USD', dias: 29, hora: '21:30:00', ubic: 'Puerto Madero, Salón VIP' }, // 200*1400=280000 -> platino
];

async function ensureSchema(pool) {
  await pool.request().query(`
    IF COL_LENGTH('productos', 'esObraDisenador') IS NULL ALTER TABLE productos ADD esObraDisenador VARCHAR(2) NULL;
    IF COL_LENGTH('productos', 'nombreArtistaDisenador') IS NULL ALTER TABLE productos ADD nombreArtistaDisenador VARCHAR(250) NULL;
    IF COL_LENGTH('productos', 'fechaObjeto') IS NULL ALTER TABLE productos ADD fechaObjeto DATE NULL;
    IF COL_LENGTH('productos', 'historiaObjeto') IS NULL ALTER TABLE productos ADD historiaObjeto VARCHAR(2000) NULL;`);
  await pool.request().query(`
    IF OBJECT_ID('productoArticulos', 'U') IS NULL
    CREATE TABLE productoArticulos (identificador INT NOT NULL IDENTITY, producto INT NOT NULL, orden INT NOT NULL, descripcion VARCHAR(1000) NOT NULL,
      CONSTRAINT pk_productoArticulos PRIMARY KEY (identificador),
      CONSTRAINT fk_productoArticulos_productos FOREIGN KEY (producto) REFERENCES productos(identificador));`);
  await pool.request().query(`
    IF OBJECT_ID('productoArticuloFotos', 'U') IS NULL
    CREATE TABLE productoArticuloFotos (identificador INT NOT NULL IDENTITY, articulo INT NOT NULL, foto VARBINARY(MAX) NOT NULL,
      CONSTRAINT pk_productoArticuloFotos PRIMARY KEY (identificador),
      CONSTRAINT fk_productoArticuloFotos_productoArticulos FOREIGN KEY (articulo) REFERENCES productoArticulos(identificador));`);
  console.log('✓ Esquema verificado');
}

// Limpia datos de subastas previos (la base partía de 0, todo lo de subastas es seed)
async function cleanup(pool) {
  const stmts = [
    'DELETE FROM pujos',
    'DELETE FROM asistentes',
    'DELETE FROM registroDeSubasta',
    'DELETE FROM multas',
    'DELETE FROM itemsCatalogo',
    'IF OBJECT_ID(\'productoArticuloFotos\',\'U\') IS NOT NULL DELETE FROM productoArticuloFotos',
    'IF OBJECT_ID(\'productoArticulos\',\'U\') IS NOT NULL DELETE FROM productoArticulos',
    'DELETE FROM fotos',
    'DELETE FROM catalogos',
    'DELETE FROM productos',
    'DELETE FROM subastas',
  ];
  for (const s of stmts) { try { await pool.request().query(s); } catch (e) { console.warn('  (cleanup skip)', e.message.split('\n')[0]); } }
  console.log('✓ Datos de subastas previos eliminados');
}

async function getOrCreatePersona(pool, documento, nombre, direccion) {
  const ex = await pool.request().input('doc', documento).query('SELECT identificador FROM personas WHERE documento = @doc');
  if (ex.recordset.length > 0) return ex.recordset[0].identificador;
  const r = await pool.request().input('doc', documento).input('nombre', nombre).input('dir', direccion)
    .query(`INSERT INTO personas (documento, nombre, direccion, estado) OUTPUT INSERTED.identificador VALUES (@doc, @nombre, @dir, 'activo')`);
  return r.recordset[0].identificador;
}

(async () => {
  let pool;
  try {
    pool = await sql.connect(config);
    await ensureSchema(pool);
    await cleanup(pool);

    const subastadorPid = await getOrCreatePersona(pool, 'DEMO-SUB-1', 'Martín Subastador', 'Av. de Mayo 500, CABA');
    if ((await pool.request().input('id', subastadorPid).query('SELECT identificador FROM subastadores WHERE identificador=@id')).recordset.length === 0)
      await pool.request().input('id', subastadorPid).query(`INSERT INTO subastadores (identificador, matricula, region) VALUES (@id, 'MAT-0001', 'CABA')`);

    const duenioPid = await getOrCreatePersona(pool, 'DEMO-DUE-1', 'Casa de Antigüedades del Plata', 'Defensa 800, San Telmo');
    if ((await pool.request().input('id', duenioPid).query('SELECT identificador FROM duenios WHERE identificador=@id')).recordset.length === 0)
      await pool.request().input('id', duenioPid).query(`INSERT INTO duenios (identificador, numeroPais, verificacionFinanciera, verificacionJudicial, calificacionRiesgo, verificador) VALUES (@id, 54, 'si', 'si', 2, 1)`);

    console.log(`✓ Subastador (persona ${subastadorPid}) y Dueño (persona ${duenioPid}) listos\n`);

    const resumen = {};
    for (const p of PRODUCTOS) {
      const categoria = resolveAuctionCategoryByPriceBase(p.precioBase, p.moneda); // <-- DERIVADA
      const comision = +(p.precioBase * 0.1).toFixed(2);                          // <-- 10%
      const fecha = dateInDays(p.dias);

      const prodRes = await pool.request()
        .input('fecha', dateInDays(0)).input('descCat', p.cat).input('descFull', p.full).input('duenio', duenioPid)
        .query(`INSERT INTO productos (fecha, disponible, descripcionCatalogo, descripcionCompleta, revisor, duenio, esObraDisenador)
                OUTPUT INSERTED.identificador VALUES (@fecha, 'si', @descCat, @descFull, 1, @duenio, 'no')`);
      const productoId = prodRes.recordset[0].identificador;

      await pool.request().input('producto', productoId).input('foto', sql.VarBinary(sql.MAX), PHOTO)
        .query('INSERT INTO fotos (producto, foto) VALUES (@producto, @foto)');

      const subRes = await pool.request()
        .input('fecha', fecha).input('hora', p.hora).input('subastador', subastadorPid)
        .input('ubic', p.ubic).input('categoria', categoria).input('moneda', p.moneda)
        .query(`INSERT INTO subastas (fecha, hora, estado, subastador, ubicacion, tieneDeposito, seguridadPropia, categoria, moneda)
                OUTPUT INSERTED.identificador
                VALUES (@fecha, @hora, 'abierta', @subastador, @ubic, 'si', 'si', @categoria, @moneda)`);
      const subastaId = subRes.recordset[0].identificador;

      const catRes = await pool.request().input('subasta', subastaId)
        .query(`INSERT INTO catalogos (subasta, descripcion, responsable) OUTPUT INSERTED.identificador VALUES (@subasta, 'Catálogo General', 1)`);
      const catalogoId = catRes.recordset[0].identificador;

      await pool.request().input('catalogo', catalogoId).input('producto', productoId)
        .input('precioBase', p.precioBase).input('comision', comision)
        .query(`INSERT INTO itemsCatalogo (catalogo, producto, precioBase, comision, subastado) VALUES (@catalogo, @producto, @precioBase, @comision, 'no')`);

      const ars = p.moneda === 'USD' ? `${p.precioBase} USD (=${p.precioBase * USD_TO_ARS_RATE} ARS)` : `${p.precioBase} ARS`;
      console.log(`  #${subastaId} [${categoria.padEnd(8)}] ${ars.padEnd(28)} com=${comision} — ${p.cat}`);
      resumen[categoria] = (resumen[categoria] || 0) + 1;
    }

    console.log('\n✅ Seed alineado a la fórmula. Por categoría:', JSON.stringify(resumen));
    await pool.close();
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    if (pool) await pool.close();
    process.exit(1);
  }
})();
