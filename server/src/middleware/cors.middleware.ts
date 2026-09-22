import cors from 'cors';

// Defaults cover local dev and the Firebase Hosting domains, so a forgotten env var can't lock out the live site.
const DEFAULT_ORIGINS = 'http://localhost:4200,http://localhost:4201,http://localhost:4210,https://odivonspa.web.app,https://odivonspa.firebaseapp.com';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ORIGINS).split(',').map((o) => o.trim());

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
