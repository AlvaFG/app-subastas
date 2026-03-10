import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './models/db';
import authRoutes from './routes/auth';
import mediosPagoRoutes from './routes/mediosPago';
import subastasRoutes from './routes/subastas';
import multasRoutes from './routes/multas';
import ventaRoutes from './routes/venta';
import estadisticasRoutes from './routes/estadisticas';
import notificacionesRoutes from './routes/notificaciones';
import rateLimit from 'express-rate-limit';
import { setupAuctionSocket } from './socket/auctionHandler';
import { setupSwagger } from './swagger';

dotenv.config();

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:8081', 'http://localhost:19006'];

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
});

// Rate limiting for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
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

// Export io for use in routes
export { io, app };

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server corriendo en puerto ${PORT}`);
  });
}
