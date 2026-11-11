import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { authRoutes, requireAuth, userRoutes } from './auth.js';
import { documentRoutes } from './documents.js';
import { errorHandler, notFound } from './errors.js';

// clientDir is the built frontend. It is optional so the API can run on its
// own in development (Vite serves the UI) and in tests.
export function createApp(db, { clientDir } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(db));
  app.use('/api/users', requireAuth(db), userRoutes(db));
  app.use('/api/documents', requireAuth(db), documentRoutes(db));
  app.use('/api', notFound);

  if (clientDir) {
    app.use(express.static(clientDir));
    // Client-side routes like /d/:id need to fall back to index.html.
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
