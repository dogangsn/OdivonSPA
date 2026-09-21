import { HttpErrorResponse } from '@angular/common/http';

export type ApiErrorCode = 'unauthenticated' | 'invalid-argument' | 'failed-precondition' | 'permission-denied' | 'not-found' | 'internal' | 'unavailable';

/** Client-side mirror of the server's `{ code, message }` error body. `.message` is always the Turkish string shown to the user. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Normalizes anything HttpClient can throw into an ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    // Status 0 means the request never got an HTTP response (server down, CORS, DNS, offline).
    if (err.status === 0) {
      return new ApiError('unavailable', 'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.', 0);
    }
    const body = err.error as { code?: string; message?: string } | undefined;
    if (body?.code && body?.message) {
      return new ApiError(body.code as ApiErrorCode, body.message, err.status);
    }
    return new ApiError('internal', 'Beklenmeyen bir hata oluştu.', err.status);
  }
  if (err instanceof Error) {
    return new ApiError('internal', err.message, 0);
  }
  return new ApiError('internal', 'Beklenmeyen bir hata oluştu.', 0);
}
