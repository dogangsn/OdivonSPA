import { Injectable, Signal, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, from, of, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiError } from '../http/api-error';
import { ApiService, QueryParams } from '../http/api.service';
import { WithId } from '../models';
import { ConfirmService } from '../ui/confirm/confirm.service';
import { DataRefreshService } from './data-refresh.service';

/** Filters understood by the Main API spa list endpoints. */
export interface ListParams extends QueryParams {
  from?: Date | string;
  to?: Date | string;
  customerId?: string;
  staffId?: string;
  productId?: string;
  status?: string;
  limit?: number;
}

/**
 * Base class for a tenant-scoped Main API resource (e.g. `/spa/customers`). Extend it per feature:
 * `class CustomerService extends ApiCrudService<Customer> { constructor() { super('/spa/customers'); } }`.
 * The tenant comes from the signed-in user on the server; the audit trail is written server-side.
 */
@Injectable()
export abstract class ApiCrudService<T extends object> {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly refresh = inject(DataRefreshService);
  private readonly feedback = inject(ConfirmService);

  protected constructor(protected readonly path: string) {}

  /** List that re-fetches after writes, periodically and on tab focus (see DataRefreshService). */
  watchAll(params: ListParams = {}): Observable<WithId<T>[]> {
    if (!this.auth.tenantId()) return of([]);
    return this.refresh.changes().pipe(
      switchMap(() =>
        from(this.api.get<WithId<T>[]>(this.path, params)).pipe(
          catchError((err: unknown) => {
            // A role without access to a list simply sees it empty, as with the old Firestore rules.
            if (!(err instanceof ApiError && err.code === 'permission-denied')) {
              console.error(`Liste yüklenemedi: ${this.path}`, err);
            }
            return of([] as WithId<T>[]);
          }),
        ),
      ),
    );
  }

  watchAllSignal(params: ListParams = {}): Signal<WithId<T>[]> {
    return toSignal(this.watchAll(params), { initialValue: [] as WithId<T>[] });
  }

  /**
   * Newest-first window for collections that only grow (sessions, payments, logs…): reads `count`
   * records instead of the whole collection. Raise `count` ("Daha fazla yükle") to extend it.
   * Must be called in an injection context (a component field initializer).
   */
  watchWindowSignal(count: Signal<number>, params: ListParams = {}): Signal<WithId<T>[]> {
    return toSignal(toObservable(count).pipe(switchMap((n) => this.watchAll({ ...params, limit: n }))), {
      initialValue: [] as WithId<T>[],
    });
  }

  watchOne(id: string): Observable<WithId<T> | undefined> {
    if (!this.auth.tenantId()) return of(undefined);
    return this.refresh.changes().pipe(
      switchMap(() =>
        from(this.api.get<WithId<T>>(`${this.path}/${encodeURIComponent(id)}`)).pipe(
          catchError(() => of(undefined)),
        ),
      ),
    );
  }

  async create(data: Omit<T, 'id'>): Promise<string> {
    const created = await this.api.post<WithId<T>>(this.path, data);
    this.refresh.notifyChanged();
    await this.feedback.toastSuccess('Kayıt başarıyla oluşturuldu');
    return created.id;
  }

  async update(id: string, patch: Partial<T>): Promise<void> {
    await this.api.patch(`${this.path}/${encodeURIComponent(id)}`, patch);
    this.refresh.notifyChanged();
    await this.feedback.toastSuccess('Değişiklikler kaydedildi');
  }

  /** Soft delete for records that carry an `active` flag instead of being deleted. */
  async setActive(id: string, active: boolean): Promise<void> {
    await this.update(id, { active } as unknown as Partial<T>);
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`${this.path}/${encodeURIComponent(id)}`);
    this.refresh.notifyChanged();
    await this.feedback.toastSuccess('Kayıt silindi');
  }

  /** For feature-specific commands (checkout, refund…): runs the call, then refreshes open lists. */
  protected async command<R>(call: Promise<R>): Promise<R> {
    const result = await call;
    this.refresh.notifyChanged();
    return result;
  }
}
