import express, { Express } from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './middleware/cors.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { internalAuthMiddleware } from './middleware/internal-auth.middleware';
import { apiRateLimit, sensitiveRateLimit } from './middleware/rate-limit.middleware';
import { errorMiddleware } from './lib/errors';
import { healthRouter } from './routes/health.routes';
import { tenantsRouter } from './routes/tenants.routes';
import { staffRouter } from './routes/staff.routes';
import { posRouter } from './routes/pos.routes';
import { paymentsRouter } from './routes/payments.routes';
import { commissionsRouter } from './routes/commissions.routes';
import { cashRegisterRouter } from './routes/cash-register.routes';
import { packagesRouter } from './routes/packages.routes';
import { appointmentsRouter } from './routes/appointments.routes';
import { internalRouter } from './routes/internal.routes';

export function createApp(): Express {
  const app = express();

  // Render sits behind a reverse proxy; needed for req.ip / x-forwarded-for to resolve correctly.
  app.set('trust proxy', true);

  app.disable('x-powered-by');
  // The API is called cross-origin from Firebase Hosting, so resources must not be pinned to same-origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(corsMiddleware);
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRouter);

  app.use('/api', authMiddleware, apiRateLimit);
  app.post(['/api/tenants', '/api/staff/invite'], sensitiveRateLimit);
  app.use('/api', tenantsRouter);
  app.use('/api', staffRouter);
  app.use('/api', posRouter);
  app.use('/api', paymentsRouter);
  app.use('/api', commissionsRouter);
  app.use('/api', cashRegisterRouter);
  app.use('/api', packagesRouter);
  app.use('/api', appointmentsRouter);

  app.use('/internal', internalAuthMiddleware, internalRouter);

  app.use(errorMiddleware);

  return app;
}
