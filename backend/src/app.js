import express from 'express';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { csrf } from './middleware/csrf.js';
import { authentication, cookieOptions } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { propertiesRoutes } from './routes/properties.routes.js';
import { imagesRoutes } from './routes/images.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { viewingsRoutes } from './routes/viewings.routes.js';
import { communityRoutes } from './routes/community.routes.js';
import { notFound } from './utils/errors.js';
import { notificationsRoutes } from './routes/notifications.routes.js';
import { requestLimit } from './middleware/request-limit.js';

export function createApp({ pool, config, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('logger', logger);
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-ID', req.requestId);
    const start = Date.now();
    res.on('finish', () => logger.info?.({ event: 'request', requestId: req.requestId,
      method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode, durationMs: Date.now() - start }));
    next();
  });
  app.use(helmet());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.vary('Cookie');
    next();
  });
  app.use(csrf(config.appOrigin));
  app.use(express.json({ limit: '64kb' }));
  const PgStore = connectPgSimple(session);
  const store = new PgStore({ pool, createTableIfMissing: false, pruneSessionInterval: config.sessionPruneSeconds ?? 900 });
  app.locals.sessionStore = store;
  app.use(session({ store, name: config.cookieName, secret: config.sessionSecret,
    resave: false, saveUninitialized: false,
    cookie: { ...cookieOptions(config), maxAge: config.sessionTtlMs } }));
  const authenticate = authentication(pool, config);
  app.get('/api/v1/ready', async (_req, res) => {
    try {
      const { rows } = await pool.query({ text: "SELECT name FROM schema_migrations WHERE name='0007_notifications_limits.sql'", query_timeout: 4000 });
      if (!rows.length) return res.status(503).json({ status: 'unavailable' });
      res.json({ status: 'ready' });
    } catch { res.status(503).json({ status: 'unavailable' }); }
  });
  app.post('/api/v1/viewings', authenticate, requestLimit(pool, { scope: 'viewings', limit: config.viewingRateLimit ?? 30, seconds: 3600, secret: config.sessionSecret, perUser: true }));
  app.post('/api/v1/reports', authenticate, requestLimit(pool, { scope: 'reports', limit: config.reportRateLimit ?? 10, seconds: 3600, secret: config.sessionSecret, perUser: true }));
  app.use('/api/v1/auth', authRoutes(pool, config, authenticate));
  app.use('/api/v1/notifications', notificationsRoutes(pool, authenticate));
  app.use('/api/v1/viewings', viewingsRoutes(pool, authenticate));
  app.use('/api/v1', communityRoutes(pool, authenticate));
  app.use('/api/v1', propertiesRoutes(pool, authenticate));
  app.use('/api/v1', imagesRoutes(pool, config, authenticate, logger));
  app.use('/api/v1/admin/users', usersRoutes(pool, authenticate));
  app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
  app.use((_req, _res, next) => next(notFound()));
  app.use(errorHandler);
  return app;
}
