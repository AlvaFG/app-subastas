/**
 * Migration runner with version control.
 *
 * - Reads connection config from .env (no hardcoded credentials).
 * - Tracks applied migrations in the schema_version table (run-once).
 * - Runs the idempotent baseline (unified-migrations.sql) first, then every
 *   server/migrations/NNN_*.sql in lexicographic order.
 * - Each .sql file is split on GO batches. All statements are idempotent.
 * - Rollback: `node run-migrations.js down <filename>` runs the section after
 *   a `-- @DOWN` marker in that migration file and removes its schema_version row.
 *
 * Usage:
 *   node run-migrations.js            apply all pending migrations
 *   node run-migrations.js down <f>   roll back migration file <f>
 */
const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'subastas',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.NODE_ENV !== 'production',
  },
};

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const BASELINE = { name: '000_baseline', file: path.join(__dirname, 'unified-migrations.sql') };

function splitBatches(content) {
  return content
    .split(/^\s*GO\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0 && b.split('\n').some((l) => l.trim() && !l.trim().startsWith('--')));
}

function upSection(content) {
  // Everything before the optional `-- @DOWN` marker is the UP migration.
  const idx = content.search(/^--\s*@DOWN\s*$/im);
  return idx === -1 ? content : content.slice(0, idx);
}

function downSection(content) {
  const m = content.split(/^--\s*@DOWN\s*$/im);
  return m.length > 1 ? m[1] : null;
}

async function ensureVersionTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID('schema_version', 'U') IS NULL
    CREATE TABLE schema_version (
      filename VARCHAR(255) NOT NULL,
      appliedAt DATETIME NOT NULL DEFAULT GETDATE(),
      CONSTRAINT pk_schema_version PRIMARY KEY (filename)
    );
  `);
}

async function isApplied(pool, name) {
  const r = await pool.request().input('f', name)
    .query('SELECT 1 FROM schema_version WHERE filename = @f');
  return r.recordset.length > 0;
}

async function markApplied(pool, name) {
  await pool.request().input('f', name)
    .query(`IF NOT EXISTS (SELECT 1 FROM schema_version WHERE filename = @f)
            INSERT INTO schema_version (filename) VALUES (@f)`);
}

async function runBatches(pool, content, label) {
  const batches = splitBatches(content);
  for (let i = 0; i < batches.length; i++) {
    try {
      await pool.request().batch(batches[i]);
    } catch (err) {
      console.error(`❌ ${label} batch ${i + 1}/${batches.length} fallo:`, err.message);
      throw err;
    }
  }
  return batches.length;
}

async function applyFile(pool, name, file) {
  if (await isApplied(pool, name)) {
    console.log(`⏭️  ${name} ya aplicada`);
    return;
  }
  const content = upSection(fs.readFileSync(file, 'utf8'));
  const n = await runBatches(pool, content, name);
  await markApplied(pool, name);
  console.log(`✅ ${name} aplicada (${n} batches)`);
}

async function runUp() {
  const pool = await sql.connect(config);
  try {
    console.log(`✅ Conectado a ${config.database}@${config.server}`);
    await ensureVersionTable(pool);
    await applyFile(pool, BASELINE.name, BASELINE.file);
    const files = fs.existsSync(MIGRATIONS_DIR)
      ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
      : [];
    for (const f of files) {
      await applyFile(pool, f, path.join(MIGRATIONS_DIR, f));
    }
    console.log('\n✅ Migraciones completadas');
  } finally {
    await pool.close();
  }
}

async function runDown(filename) {
  const file = path.join(MIGRATIONS_DIR, filename);
  if (!fs.existsSync(file)) {
    console.error(`❌ Migracion no encontrada: ${filename}`);
    process.exit(1);
  }
  const down = downSection(fs.readFileSync(file, 'utf8'));
  if (!down || !down.trim()) {
    console.error(`❌ ${filename} no tiene seccion -- @DOWN`);
    process.exit(1);
  }
  const pool = await sql.connect(config);
  try {
    await ensureVersionTable(pool);
    await runBatches(pool, down, `${filename} (down)`);
    await pool.request().input('f', filename)
      .query('DELETE FROM schema_version WHERE filename = @f');
    console.log(`✅ Rollback de ${filename} completado`);
  } finally {
    await pool.close();
  }
}

const [, , cmd, arg] = process.argv;
const action = cmd === 'down' ? runDown(arg) : runUp();
action.catch((err) => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
