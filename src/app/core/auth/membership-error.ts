import { ApiError } from '../http/api-error';

/** Keeps a backend membership-recovery failure separate from an actual Google popup failure. */
export function describeMembershipError(error: unknown, fallback: (error: unknown) => string): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'failed-precondition':
        return error.message;
      case 'unavailable':
        return 'İşletme üyeliğiniz doğrulanamadı çünkü sunucuya ulaşılamıyor. Lütfen daha sonra tekrar deneyin.';
      case 'unauthenticated':
        return 'Oturumunuz doğrulanamadı. Lütfen yeniden giriş yapın.';
      default:
        return 'İşletme üyeliğiniz doğrulanamadı. Lütfen daha sonra tekrar deneyin.';
    }
  }
  return fallback(error);
}
