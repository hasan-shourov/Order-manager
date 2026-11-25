import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { config } from './config';
import { ApiError, zodIssues } from './lib/errors';
import { requireAdmin, requireAuth } from './middleware/auth';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import catalogRoutes from './routes/catalog';
import memoRoutes from './routes/memos';
import settingsRoutes from './routes/settings';
import summaryRoutes from './routes/summary';

function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }

  let allowed = config.corsOrigins.includes('*') || config.corsOrigins.includes(origin);
  if (!allowed) {
    try {
      allowed = new URL(origin).host === req.headers.host;
    } catch {
      allowed = false;
    }
  }

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
  app.use('/api/settings', requireAuth, settingsRoutes);
  app.use('/api/memos', requireAuth, memoRoutes);
  app.use('/api/summary', requireAuth, summaryRoutes);
  app.use('/api', requireAuth, catalogRoutes);

  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Endpoint not found.' },
    });
  });

  const webDist = path.resolve(__dirname, '../../web/dist');
  const indexHtml = path.join(webDist, 'index.html');
  if (config.serveWeb && fs.existsSync(indexHtml)) {
    app.use(express.static(webDist, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      if (!req.accepts('html')) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  app.use(
    (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
      if (res.headersSent) {
        next(error);
        return;
      }
      if (error instanceof ApiError) {
        res.status(error.status).json({
          error: {
            code: error.code,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
        });
        return;
      }
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please review the highlighted fields.',
            details: zodIssues(error),
          },
        });
        return;
      }
      console.error('[server] Unhandled error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again.',
        },
      });
    }
  );

  return app;
}
