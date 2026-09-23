import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

/**
 * Cloud Functions gets an ambient service-account credential for free; a standalone server
 * doesn't, so we either point at the local emulator suite (no credential needed) or load a
 * real service-account key from an env var (never committed to the repo).
 */
function buildApp() {
  const usingEmulators = !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (usingEmulators) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'odivonspa' });
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    let serviceAccount: object;
    try {
      serviceAccount = JSON.parse(raw);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
    }
    return initializeApp({ credential: cert(serviceAccount as never) });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Production needs a Firebase service-account JSON key.',
    );
  }

  // Local development can use `gcloud auth application-default login` without copying a
  // service-account key into .env. Render remains protected by the production check above.
  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT ?? 'odivonspa',
  });
}

buildApp();

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue };

export function tenantCollection(tenantId: string, collection: string) {
  return db.collection(`tenants/${tenantId}/${collection}`);
}

export function tenantDoc(tenantId: string, collection: string, id: string) {
  return db.doc(`tenants/${tenantId}/${collection}/${id}`);
}
