import express, { Express } from 'express';
import { corsMiddleware } from './middleware/cors.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { internalAuthMiddleware } from './middleware/internal-auth.middleware';
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

  app.use(corsMiddleware);
  app.use(express.json());

  app.use(healthRouter);

  app.use('/api', authMiddleware, tenantsRouter);
  app.use('/api', authMiddleware, staffRouter);
  app.use('/api', authMiddleware, posRouter);
  app.use('/api', authMiddleware, paymentsRouter);
  app.use('/api', authMiddleware, commissionsRouter);
  app.use('/api', authMiddleware, cashRegisterRouter);
  app.use('/api', authMiddleware, packagesRouter);
  app.use('/api', authMiddleware, appointmentsRouter);

  app.use('/internal', internalAuthMiddleware, internalRouter);

  app.use(errorMiddleware);

  return app;
}
