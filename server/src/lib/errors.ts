import { NextFunction, Request, Response } from 'express';

export type ApiErrorCode = 'unauthenticated' | 'invalid-argument' | 'failed-precondition' | 'permission-denied' | 'not-found' | 'internal';

const CODE_TO_STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  'invalid-argument': 400,
  'failed-precondition': 400,
  'permission-denied': 403,
  'not-found': 404,
  internal: 500,
};

/** Thrown by route handlers — mirrors `HttpsError(code, message)` from the old Cloud Functions. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Registered last in app.ts. Preserves the exact Turkish message strings all client call sites already display. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(CODE_TO_STATUS[err.code]).json({ code: err.code, message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ code: 'internal', message: 'Beklenmeyen bir hata oluştu.' });
}

/** Wraps an async Express handler so a thrown/rejected error reaches errorMiddleware via next(). */
export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}
