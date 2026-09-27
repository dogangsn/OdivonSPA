import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, of, switchMap } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import { Tenant } from '../../../core/models';
import { DataRefreshService } from '../../../core/services/data-refresh.service';

export type TenantSettingsPatch = Pick<Tenant, 'name'> & { settings: NonNullable<Tenant['settings']> };

/** Business name and working-hours settings (`/spa/settings`); the server writes the audit entry. */
@Injectable({ providedIn: 'root' })
export class TenantSettingsService {
  private readonly api = inject(ApiService);
  private readonly refresh = inject(DataRefreshService);

  watch(): Observable<Pick<Tenant, 'name' | 'settings'> | undefined> {
    return this.refresh.changes().pipe(
      switchMap(() =>
        from(this.api.get<Pick<Tenant, 'name' | 'settings'>>('/spa/settings')).pipe(catchError(() => of(undefined))),
      ),
    );
  }

  async save(patch: TenantSettingsPatch): Promise<void> {
    await this.api.patch('/spa/settings', { name: patch.name, ...patch.settings });
    this.refresh.notifyChanged();
  }
}
