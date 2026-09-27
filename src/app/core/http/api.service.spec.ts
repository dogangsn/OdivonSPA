import { HttpErrorResponse } from '@angular/common/http';
import { toApiError } from './api-error';
import { reviveDates } from './api.service';

describe('reviveDates', () => {
  it('turns ISO instants into Dates and leaves day ids and other strings alone', () => {
    const revived = reviveDates({
      createdAt: '2026-09-27T10:00:00.000Z',
      date: '2026-09-27',
      items: [{ at: '2026-09-27T10:00:00Z', ad: 'Masaj' }],
    });
    expect(revived.createdAt).toBeInstanceOf(Date);
    expect(revived.date).toBe('2026-09-27');
    expect(revived.items[0].at).toBeInstanceOf(Date);
    expect(revived.items[0].ad).toBe('Masaj');
  });
});

describe('toApiError', () => {
  const httpError = (status: number, code: string, message: string) =>
    new HttpErrorResponse({ status, error: { success: false, error: { code, message } } });

  it('keeps the Turkish message of spa errors and maps the code', () => {
    const err = toApiError(httpError(409, 'SPA_PRECONDITION', 'Oda bu saatte dolu.'));
    expect(err.code).toBe('failed-precondition');
    expect(err.message).toBe('Oda bu saatte dolu.');
  });

  it('replaces English Main API messages with Turkish ones', () => {
    const err = toApiError(httpError(403, 'FORBIDDEN_PERMISSION', 'Missing permission spaExpenses:view'));
    expect(err.code).toBe('permission-denied');
    expect(err.message).toBe('Bu işlem için yetkiniz yok.');
  });

  it('exposes the raw code for a missing profile (onboarding)', () => {
    const err = toApiError(httpError(404, 'USER_NOT_FOUND', 'User profile was not found'));
    expect(err.apiCode).toBe('USER_NOT_FOUND');
    expect(err.code).toBe('not-found');
  });

  it('reports an unreachable server', () => {
    expect(toApiError(new HttpErrorResponse({ status: 0 })).code).toBe('unavailable');
  });
});
