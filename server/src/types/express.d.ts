import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Set by auth.middleware.ts when a valid Firebase ID token is present. Mirrors CallableRequest.auth. */
      auth?: {
        uid: string;
        token: Record<string, unknown>;
      };
    }
  }
}
