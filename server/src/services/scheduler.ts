/**
 * Background scheduler (REQ-06).
 *
 * The TPO requires that an unpaid penalty (multa) gives the bidder 72h to pay;
 * on non-compliance the case is escalated to justice and the account is blocked
 * from the whole app. This job sweeps overdue, still-unpaid fines hourly and:
 *   - marks them derivadaJusticia = 'si'
 *   - sets the bidder's account to inactivo (login already rejects both states)
 *   - notifies the bidder
 *
 * Note: the 72h window itself is set when the fine is created (fechaLimite),
 * see auctionHandler. This job only acts once that deadline has passed.
 */
import { connectDB } from '../models/db';

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
let timer: NodeJS.Timeout | null = null;

export async function deriveOverdueFines(): Promise<number> {
  const pool = await connectDB();

  const overdue = await pool.request().query(`
    SELECT identificador, cliente
    FROM multas
    WHERE pagada = 'no' AND derivadaJusticia = 'no' AND fechaLimite < GETDATE()
  `);

  for (const fine of overdue.recordset) {
    await pool.request()
      .input('id', fine.identificador)
      .query("UPDATE multas SET derivadaJusticia = 'si' WHERE identificador = @id");

    await pool.request()
      .input('cliente', fine.cliente)
      .query("UPDATE personas SET estado = 'inactivo' WHERE identificador = @cliente");

    await pool.request()
      .input('cliente', fine.cliente)
      .query(`
        INSERT INTO notificaciones (cliente, tipo, titulo, mensaje)
        VALUES (@cliente, 'multa', 'Caso derivado a la justicia',
          'El incumplimiento de pago no fue regularizado dentro de las 72hs. El caso fue derivado a la justicia y su cuenta quedo bloqueada.')
      `);
  }

  if (overdue.recordset.length > 0) {
    console.log(`[scheduler] ${overdue.recordset.length} multa(s) vencida(s) derivadas a justicia`);
  }
  return overdue.recordset.length;
}

export function startScheduler(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (timer) return;
  const run = () => {
    deriveOverdueFines().catch((err) =>
      console.error('[scheduler] error procesando multas vencidas:', err.message)
    );
  };
  run(); // run once at startup
  timer = setInterval(run, SWEEP_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
