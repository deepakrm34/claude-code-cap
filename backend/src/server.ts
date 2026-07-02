import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { closePool } from './db';
import authRouter from './routes/auth';
import tasksRouter from './routes/tasks';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// --- Middleware ------------------------------------------------------------
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Routes ----------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authRouter);
app.use('/tasks', tasksRouter);

// --- 404 handler -----------------------------------------------------------
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// --- Error handler ---------------------------------------------------------
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// --- Start server ----------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${String(PORT)}`);
});

// --- Graceful shutdown -----------------------------------------------------
const shutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  server.close(() => {
    void (async () => {
      console.log('HTTP server closed.');
      try {
        await closePool();
        console.log('PostgreSQL pool closed.');
      } catch (err) {
        console.error('Error closing PostgreSQL pool:', err);
      }
      process.exit(0);
    })();
  });
};

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

export default app;
