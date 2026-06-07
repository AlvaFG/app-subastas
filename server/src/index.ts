import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './models/db';
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import mediosPagoRoutes from './routes/mediosPago';
import subastasRoutes from './routes/subastas';
import multasRoutes from './routes/multas';
import ventaRoutes from './routes/venta';
import estadisticasRoutes from './routes/estadisticas';
import notificacionesRoutes from './routes/notificaciones';
import rateLimit from 'express-rate-limit';
import { setupAuctionSocket } from './socket/auctionHandler';
import { setupSwagger } from './swagger';
import { validateEnv } from './config/env';
import { startScheduler } from './services/scheduler';
import type { NextFunction, Request, Response } from 'express';

dotenv.config();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:8081', 'http://localhost:19006'];

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

// Rate limiting for auth (anti fuerza bruta). Configurable por env:
//   AUTH_RATE_LIMIT_MAX = requests por IP cada 15 min (default 200, generoso).
//   AUTH_RATE_LIMIT_MAX = 0  -> desactiva el limiter (util para testing/demo).
// Nota: el login ademas tiene bloqueo por cuenta (failedAttempts/lockUntil), que
// es la proteccion principal contra fuerza bruta — el limiter por IP es secundario.
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '200', 10);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: AUTH_RATE_LIMIT_MAX,
  skip: () => process.env.NODE_ENV === 'test' || AUTH_RATE_LIMIT_MAX <= 0,
  message: { success: false, error: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    const pool = await connectDB();
    await pool.request().query('SELECT 1');
    res.json({ success: true, data: { status: 'ok', db: 'connected' } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/medios-pago', mediosPagoRoutes);
app.use('/api/subastas', subastasRoutes);
app.use('/api/multas', multasRoutes);
app.use('/api/venta', ventaRoutes);
app.use('/api/usuarios', estadisticasRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

// Swagger API Docs
setupSwagger(app);

// Socket.IO — Auction handler
setupAuctionSocket(io);

// Background scheduler (multas vencidas 72hs -> justicia). No-op en test.
startScheduler();

// 404 handler para rutas /api no encontradas
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Recurso no encontrado' });
});

// Error handler global de Express
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error] ', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// Export io for use in routes
export { io, app };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  validateEnv(); // falla rapido si faltan secretos requeridos
  server.listen({ port: PORT, host: '0.0.0.0' }, () => {
    console.log(`Server corriendo en puerto ${PORT}`);
  });
}
