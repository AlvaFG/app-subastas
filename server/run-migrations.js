const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: 'localhost',
  authentication: {
    type: 'default',
    options: {
      userName: 'sa',
      password: 'TuContraseña123'
    }
  },
  options: {
    encrypt: true,
    trustServerCertificate: true,
    database: 'subastas',
    port: 1433
  }
};

const migrations = [
  'src/migrations/001_fix_typos.sql',
  'src/migrations/002_nuevas_columnas.sql',
  'src/migrations/003_nuevas_tablas.sql'
];

async function runMigrations() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Conectado a SQL Server');

    for (const migrationFile of migrations) {
      const migrationPath = path.join(__dirname, migrationFile);
      const sql_script = fs.readFileSync(migrationPath, 'utf8');

      console.log(`\n📝 Ejecutando: ${path.basename(migrationFile)}`);

      try {
        const result = await pool.request().batch(sql_script);
        console.log(`✅ ${path.basename(migrationFile)} completada`);
      } catch (err) {
        console.error(`❌ Error en ${path.basename(migrationFile)}:`, err.message);
        if (err.message.includes('already exists')) {
          console.log('⚠️  Tabla ya existe (ignorado)');
        } else if (err.message.includes('already present')) {
          console.log('⚠️  Constraint ya existe (ignorado)');
        } else if (err.message.includes('CONSTRAINT')) {
          console.log('⚠️  Constraint issue (puede ser idempotent)');
        } else {
          throw err;
        }
      }
    }

    console.log('\n✅ Migraciones completadas!');
    await pool.close();
  } catch (err) {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  }
}

runMigrations();
