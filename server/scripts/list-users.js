require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'subastas',
  options: {
    encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
    trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() === 'true',
  },
  port: Number(process.env.DB_PORT || 1433),
};

(async () => {
  if (!config.password) {
    console.error('Missing DB_PASSWORD in server/.env');
    process.exit(1);
  }

  const pool = await sql.connect(config);

  const users = await pool.request().query(`
    SELECT TOP 50 c.identificador, c.email, c.admitido, c.categoria, p.nombre
    FROM clientes c
    INNER JOIN personas p ON p.identificador = c.identificador
    WHERE c.email IS NOT NULL
    ORDER BY c.identificador
  `);

  console.log('USERS_WITH_EMAIL');
  console.table(users.recordset);

  await pool.close();
})().catch((e) => {
  console.error('QUERY_ERROR', e.message);
  process.exit(1);
});
