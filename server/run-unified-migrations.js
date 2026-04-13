const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  user: 'sa',
  password: 'TuContraseña123',
  server: 'localhost',
  database: 'subastas',
  options: { encrypt: true, trustServerCertificate: true, port: 1433 }
};

async function runUnifiedMigrations() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Conectado a SQL Server');

    const migrationPath = path.join(__dirname, 'unified-migrations.sql');
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Split by GO (case insensitive)
    const batches = sqlContent
      .split(/^GO\s*$/gim)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0 && !batch.startsWith('--'));

    console.log(`\n📝 Ejecutando ${batches.length} batches...`);

    for (let i = 0; i < batches.length; i++) {
      try {
        await pool.request().batch(batches[i]);
        console.log(`✅ Batch ${i + 1}/${batches.length}`);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already') || err.message.includes('already an object')) {
          console.log(`⚠️  Batch ${i + 1}: Ya existe (ignorado)`);
        } else {
          console.error(`❌ Batch ${i + 1} error:`, err.message.substring(0, 100));
          throw err;
        }
      }
    }

    console.log('\n✅ ¡Todas las migraciones completadas exitosamente!');
    await pool.close();
  } catch (err) {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  }
}

runUnifiedMigrations();
