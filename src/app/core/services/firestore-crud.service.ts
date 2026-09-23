import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryConstraint,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  query,
  serverTimestamp,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { WithId } from '../models';
import { ConfirmService } from '../ui/confirm/confirm.service';

/**
 * Base class for tenant-scoped Firestore collections (`tenants/{tenantId}/{collectionName}`).
 * Extend it per feature, e.g. `class CustomerService extends FirestoreCrudService<Customer> { constructor() { super('customers'); } }`.
 * Every read/write is automatically scoped to the current user's tenant.
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

  async create(data: Omit<T, 'id'>): Promise<string> {
    const ref = this.collectionRef();
    if (!ref) throw new Error('Tenant context missing — cannot create document.');
    const uid = this.auth.user()?.uid ?? 'unknown';
    const payload = { ...data, createdAt: serverTimestamp(), createdBy: uid };
    const created = await addDoc(ref, payload as unknown as T);
    await this.feedback.toastSuccess('Kayıt başarıyla oluşturuldu');
    return created.id;
  }

  async update(id: string, patch: Partial<T>): Promise<void> {
    const ref = this.docRef(id);
    if (!ref) throw new Error('Tenant context missing — cannot update document.');
    const uid = this.auth.user()?.uid ?? 'unknown';
    await updateDoc(ref, { ...patch, updatedAt: serverTimestamp(), updatedBy: uid } as DocumentData);
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
    await deleteDoc(ref);
    await this.feedback.toastSuccess('Kayıt silindi');
  }
}
