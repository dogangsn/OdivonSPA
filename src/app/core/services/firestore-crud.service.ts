import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  collection,
  collectionData,
  doc,
  docData,
  getDoc,
  query,
  serverTimestamp,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { WithId } from '../models';
import { ConfirmService } from '../ui/confirm/confirm.service';
import { auditEntry, deleteAuditId, pickKeys } from './audit-trail';

/**
 * Base class for tenant-scoped Firestore collections (`tenants/{tenantId}/{collectionName}`).
 * Extend it per feature, e.g. `class CustomerService extends FirestoreCrudService<Customer> { constructor() { super('customers'); } }`.
 * Every read/write is automatically scoped to the current user's tenant.
 *
 * Writes are batched with an `auditLogs` entry; firestore.rules reject an audited collection's write
 * unless that entry exists in the same batch and names the caller (see `audited()` in the rules).
 */
@Injectable()
export abstract class FirestoreCrudService<T extends DocumentData> {
  protected readonly firestore = inject(Firestore);
  protected readonly auth = inject(AuthService);
  private readonly feedback = inject(ConfirmService);

  protected constructor(private readonly collectionName: string) {}

  protected collectionRef(): CollectionReference<T> | null {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return null;
    return collection(this.firestore, `tenants/${tenantId}/${this.collectionName}`) as CollectionReference<T>;
  }

  protected docRef(id: string) {
    const tenantId = this.auth.tenantId();
    if (!tenantId) return null;
    return doc(this.firestore, `tenants/${tenantId}/${this.collectionName}/${id}`);
  }

  /** Reactive list, re-queried automatically whenever the tenant changes. Pass constraints for filtering/ordering. */
  watchAll(...constraints: QueryConstraint[]): Observable<WithId<T>[]> {
    const ref = this.collectionRef();
    if (!ref) return of([]);
    const q: Query<T> = constraints.length ? query(ref, ...constraints) : ref;
    return collectionData(q, { idField: 'id' }) as Observable<WithId<T>[]>;
  }

  watchAllSignal(...constraints: QueryConstraint[]) {
    return toSignal(this.watchAll(...constraints), { initialValue: [] as WithId<T>[] });
  }

  watchOne(id: string): Observable<WithId<T> | undefined> {
    const ref = this.docRef(id);
    if (!ref) return of(undefined);
    return docData(ref, { idField: 'id' }) as Observable<WithId<T> | undefined>;
  }

  private auditRef(id?: string) {
    const tenantId = this.auth.tenantId()!;
    const logs = collection(this.firestore, `tenants/${tenantId}/auditLogs`);
    return id ? doc(logs, id) : doc(logs);
  }

  private actor() {
    const user = this.auth.user();
    return { uid: user?.uid ?? 'unknown', email: user?.email ?? '' };
  }

  async create(data: Omit<T, 'id'>): Promise<string> {
    const ref = this.collectionRef();
    if (!ref) throw new Error('Tenant context missing — cannot create document.');
    const actor = this.actor();
    const created = doc(ref);
    const auditRef = this.auditRef();
    const batch = writeBatch(this.firestore);
    batch.set(created, { ...data, createdAt: serverTimestamp(), createdBy: actor.uid, auditId: auditRef.id } as DocumentData);
    batch.set(auditRef, auditEntry(this.collectionName, 'create', created.id, null, data as DocumentData, actor));
    await batch.commit();
    await this.feedback.toastSuccess('Kayıt başarıyla oluşturuldu');
    return created.id;
  }

  async update(id: string, patch: Partial<T>): Promise<void> {
    const ref = this.docRef(id);
    if (!ref) throw new Error('Tenant context missing — cannot update document.');
    const actor = this.actor();
    const current = await getDoc(ref);
    const auditRef = this.auditRef();
    const batch = writeBatch(this.firestore);
    batch.update(ref, { ...patch, updatedAt: serverTimestamp(), updatedBy: actor.uid, auditId: auditRef.id } as DocumentData);
    batch.set(
      auditRef,
      auditEntry(this.collectionName, 'update', id, pickKeys(current.data() ?? {}, Object.keys(patch)), patch as DocumentData, actor),
    );
    await batch.commit();
    await this.feedback.toastSuccess('Değişiklikler kaydedildi');
  }

  /** Soft delete for collections that carry an `active` flag instead of being hard-deleted. */
  async setActive(id: string, active: boolean): Promise<void> {
    await this.update(id, { active } as unknown as Partial<T>);
  }

  /** Hard delete — only use for purely internal/administrative collections, never customer/financial records. */
  async remove(id: string): Promise<void> {
    const ref = this.docRef(id);
    if (!ref) throw new Error('Tenant context missing — cannot delete document.');
    const current = await getDoc(ref);
    const batch = writeBatch(this.firestore);
    batch.delete(ref);
    batch.set(this.auditRef(deleteAuditId(this.collectionName, id)), auditEntry(this.collectionName, 'delete', id, current.data() ?? null, null, this.actor()));
    await batch.commit();
    await this.feedback.toastSuccess('Kayıt silindi');
  }
}
