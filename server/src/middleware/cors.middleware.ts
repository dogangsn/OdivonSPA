import cors from 'cors';

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:4200').split(',').map((o) => o.trim());

export const corsMiddleware = cors({
  origin(origin, callback) {
    // No Origin header (curl, server-to-server, the /internal cron caller) — allow.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: false,
});
