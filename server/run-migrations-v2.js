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
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      console.log(`\n📝 Ejecutando: ${path.basename(migrationFile)}`);

      // Split by GO (SQL Server batch separator)
      const batches = sqlContent
        .split(/^GO\s*$/gm)
        .map(batch => batch.trim())
        .filter(batch => batch.length > 0 && !batch.startsWith('--'));

      for (const batch of batches) {
        try {
          await pool.request().batch(batch);
        } catch (err) {
          const errorMsg = err.message;
          if (
            errorMsg.includes('already exists') ||
            errorMsg.includes('already present') ||
            errorMsg.includes('CONSTRAINT') ||
            errorMsg.includes('duplicate')
          ) {
            console.log('⚠️  ' + errorMsg.substring(0, 60) + '... (ignorado)');
          } else {
            throw err;
          }
        }
      }

      console.log(`✅ ${path.basename(migrationFile)} completada`);
    }

    console.log('\n✅ ¡Migraciones completadas exitosamente!');
    await pool.close();
  } catch (err) {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  }
}

runMigrations();
