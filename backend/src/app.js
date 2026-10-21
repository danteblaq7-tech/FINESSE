
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { pool } from './db.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import { applicationsRouter, periodsRouter } from './routes/exam.js';
import feeRoutes from './routes/fees.js';
import slotRoutes from './routes/slots.js';
import templateRoutes from './routes/templates.js';
import ticketRoutes from './routes/tickets.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Security headers
  app.use(helmet());

  // Allowed web origins from config.js / environment variables.
  // Supports comma-separated origins, including localhost:5173
  // and localhost:8081.
  const configuredOrigins = Array.isArray(config.corsOrigins)
    ? config.corsOrigins
    : String(config.corsOrigins || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

  const allowedOrigins = new Set(configuredOrigins);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without an Origin header, such as native
        // mobile apps and server-to-server requests.
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }

        return callback(
          new Error(`CORS blocked this origin: ${origin}`)
        );
      },
      credentials: false,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      optionsSuccessStatus: 204,
    })
  );

  app.use(express.json({ limit: '2mb' }));

  // API health check
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: 'connected' });
    } catch {
      res.status(503).json({ ok: false, db: 'unreachable' });
    }
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/slots', slotRoutes);
  app.use('/api/fee-records', feeRoutes);
  app.use('/api/exam-periods', periodsRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api', templateRoutes);

  // 404 and error handlers
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
