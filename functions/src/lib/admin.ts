import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

initializeApp();

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue };

export function tenantCollection(tenantId: string, collection: string) {
  return db.collection(`tenants/${tenantId}/${collection}`);
}

export function tenantDoc(tenantId: string, collection: string, id: string) {
  return db.doc(`tenants/${tenantId}/${collection}/${id}`);
}
