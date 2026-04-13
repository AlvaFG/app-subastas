const sql = require('mssql');

const config = {
  server: 'localhost',
  user: 'sa',
  password: 'TuContraseña123',
  database: 'master',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    port: 1433
  }
};

async function createDatabase() {
  const pool = new sql.ConnectionPool(config);

  try {
    await pool.connect();
    console.log('✅ Conectado a SQL Server (master)');

    // Check if database exists
    const dbCheck = await pool.request()
      .query("SELECT name FROM sys.databases WHERE name = 'subastas'");

    if (dbCheck.recordset.length > 0) {
      console.log('✅ Base de datos "subastas" ya existe');
    } else {
      console.log('📝 Creando base de datos "subastas"...');
      await pool.request().query('CREATE DATABASE subastas');
      console.log('✅ Base de datos "subastas" creada');
    }

    await pool.close();
  } catch (err) {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
  }
}

createDatabase();
