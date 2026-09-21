import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toApiError } from './api-error';

/** Thin wrapper around the backend API (server/, hosted on Render) — replaces httpsCallable. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  async post<T>(path: string, body?: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.post<T>(`${this.base}${path}`, body ?? {}));
    } catch (err) {
      throw toApiError(err);
    }
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.http.patch<T>(`${this.base}${path}`, body ?? {}));
    } catch (err) {
      throw toApiError(err);
    }
  }
}
