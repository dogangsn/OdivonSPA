import { HttpErrorResponse } from '@angular/common/http';

export type ApiErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'failed-precondition'
  | 'permission-denied'
  | 'not-found'
  | 'resource-exhausted'
  | 'internal'
  | 'unavailable';

/** Client-side view of a Main API error. `.message` is the Turkish string shown to the user. */
export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    /** Raw Main API error code, e.g. `SPA_PRECONDITION` or `USER_NOT_FOUND`. */
    public readonly apiCode?: string,
  ) {
    super(message);
  }
}

/** Main API error body: `{ success: false, error: { code, message } }`. */
interface MainApiErrorBody {
  error?: { code?: string; message?: string };
}

function codeFor(status: number, apiCode: string | undefined): ApiErrorCode {
  if (apiCode === 'SPA_INVALID' || apiCode === 'VALIDATION_ERROR') return 'invalid-argument';
  if (apiCode === 'SPA_PRECONDITION') return 'failed-precondition';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'permission-denied';
  if (status === 404) return 'not-found';
  if (status === 409) return 'failed-precondition';
  if (status === 429) return 'resource-exhausted';
  if (status === 400) return 'invalid-argument';
  if (status === 503) return 'unavailable';
  return 'internal';
}

const GENERIC_MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  unauthenticated: 'Bu işlem için giriş yapmanız gerekiyor.',
  'permission-denied': 'Bu işlem için yetkiniz yok.',
  'resource-exhausted': 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.',
  internal: 'Beklenmeyen bir hata oluştu.',
};

/** Normalizes anything HttpClient can throw into an ApiError. */
export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    // Status 0 means the request never got an HTTP response (server down, CORS, DNS, offline).
    if (err.status === 0) {
      return new ApiError('unavailable', 'Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin.', 0);
    }
    const body = err.error as MainApiErrorBody | undefined;
    const apiCode = body?.error?.code;
    const code = codeFor(err.status, apiCode);
    // Spa endpoints send Turkish messages; MainApi's own errors are English, so wrap or replace those.
    const raw = body?.error?.message;
    const message =
      apiCode === 'VALIDATION_ERROR'
        ? `Girilen bilgiler geçersiz${raw ? ` (${raw})` : ''}.`
        : (apiCode?.startsWith('SPA_') && raw) || GENERIC_MESSAGES[code] || 'Beklenmeyen bir hata oluştu.';
    return new ApiError(code, message, err.status, apiCode);
  }
  if (err instanceof ApiError) {
    return err;
  }
  if (err instanceof Error) {
    return new ApiError('internal', err.message, 0);
  }
  return new ApiError('internal', 'Beklenmeyen bir hata oluştu.', 0);
}
