import express from 'express';
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

export function createApp({ pool, config, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('logger', logger);
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
  app.use('/api/v1/auth', authRoutes(pool, config, authenticate));
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
