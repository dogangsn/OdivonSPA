import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, docData, getDoc, writeBatch } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { Tenant } from '../../../core/models';
import { auditEntry, pickKeys } from '../../../core/services/audit-trail';

export type TenantSettingsPatch = Pick<Tenant, 'name'> & { settings: NonNullable<Tenant['settings']> };

/** The tenant root document isn't a sub-collection, so it gets its own small service instead of FirestoreCrudService. */
@Injectable({ providedIn: 'root' })
export class TenantSettingsService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(AuthService);

  private tenantRef() {
    const tenantId = this.auth.tenantId();
    return tenantId ? doc(this.firestore, `tenants/${tenantId}`) : null;
  }

  watch(): Observable<Tenant | undefined> {
    const ref = this.tenantRef();
    return ref ? (docData(ref) as Observable<Tenant | undefined>) : of(undefined);
  }

  /** Same audited-batch pattern as FirestoreCrudService.update — firestore.rules require the log entry. */
  async save(patch: TenantSettingsPatch): Promise<void> {
    const ref = this.tenantRef();
    if (!ref) throw new Error('Tenant context missing.');
    const user = this.auth.user();
    const current = await getDoc(ref);
    const auditRef = doc(collection(ref, 'auditLogs'));
    const batch = writeBatch(this.firestore);
    batch.update(ref, { ...patch, auditId: auditRef.id });
    batch.set(
      auditRef,
      auditEntry('tenants', 'update', ref.id, pickKeys(current.data() ?? {}, ['name', 'settings']), patch, {
        uid: user?.uid ?? 'unknown',
        email: user?.email ?? '',
      }),
    );
    await batch.commit();
  }
}
