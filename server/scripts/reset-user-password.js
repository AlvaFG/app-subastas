require('dotenv').config();
const bcrypt = require('bcrypt');
const sql = require('mssql');

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-user-password.js <email> <newPassword>');
  process.exit(1);
}

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

  const exists = await pool.request()
    .input('email', sql.VarChar(250), email)
    .query('SELECT identificador FROM clientes WHERE email = @email');

  if (exists.recordset.length === 0) {
    console.error(`User not found for email: ${email}`);
    await pool.close();
    process.exit(1);
  }

  const claveHash = await bcrypt.hash(newPassword, 10);

  await pool.request()
    .input('email', sql.VarChar(250), email)
    .input('claveHash', sql.VarChar(250), claveHash)
    .query('UPDATE clientes SET claveHash = @claveHash WHERE email = @email');

  console.log(`Password updated for ${email}`);
  await pool.close();
})().catch((e) => {
  console.error('RESET_ERROR', e.message);
  process.exit(1);
});
