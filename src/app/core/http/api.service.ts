import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toApiError } from './api-error';

/** Main API success body: `{ success: true, data, meta }`. */
interface Envelope<T> {
  data: T;
}

export type QueryParams = Record<string, string | number | boolean | Date | null | undefined>;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Main API stores instants as ISO strings; turn them back into `Date`s for the UI. */
export function reviveDates<T>(value: T): T {
  if (typeof value === 'string') {
    return (ISO_INSTANT.test(value) ? new Date(value) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, reviveDates(item)])) as T;
  }
  return value;
}

function toParams(query?: QueryParams): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    params = params.set(key, value instanceof Date ? value.toISOString() : String(value));
  }
  return params;
}

/** Thin wrapper around Odivon Main API: unwraps the `data` envelope and normalizes errors. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.send(this.http.get<Envelope<T>>(`${this.base}${path}`, { params: toParams(query) }));
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.send(this.http.post<Envelope<T>>(`${this.base}${path}`, body ?? {}));
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.send(this.http.patch<Envelope<T>>(`${this.base}${path}`, body ?? {}));
  }

  delete<T>(path: string): Promise<T> {
    return this.send(this.http.delete<Envelope<T>>(`${this.base}${path}`));
  }

  private async send<T>(request: Observable<Envelope<T>>): Promise<T> {
    try {
      const body = await firstValueFrom(request);
      return reviveDates(body.data);
    } catch (err) {
      throw toApiError(err);
    }
  }
}
