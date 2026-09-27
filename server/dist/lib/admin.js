"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldValue = exports.auth = exports.db = void 0;
exports.tenantCollection = tenantCollection;
exports.tenantDoc = tenantDoc;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
Object.defineProperty(exports, "FieldValue", { enumerable: true, get: function () { return firestore_1.FieldValue; } });
const auth_1 = require("firebase-admin/auth");
/**
 * Cloud Functions gets an ambient service-account credential for free; a standalone server
 * doesn't, so we either point at the local emulator suite (no credential needed) or load a
 * real service-account key from an env var (never committed to the repo).
 */
function buildApp() {
    const usingEmulators = !!process.env.FIRESTORE_EMULATOR_HOST || !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (usingEmulators) {
        return (0, app_1.initializeApp)({ projectId: process.env.GCLOUD_PROJECT ?? 'odivonspa' });
    }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (raw) {
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(raw);
        }
        catch {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.');
        }
        return (0, app_1.initializeApp)({ credential: (0, app_1.cert)(serviceAccount) });
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Production needs a Firebase service-account JSON key.');
    }
    // Local development can use `gcloud auth application-default login` without copying a
    // service-account key into .env. Render remains protected by the production check above.
    return (0, app_1.initializeApp)({
        credential: (0, app_1.applicationDefault)(),
        projectId: process.env.GCLOUD_PROJECT ?? 'odivonspa',
    });
}
buildApp();
exports.db = (0, firestore_1.getFirestore)();
exports.auth = (0, auth_1.getAuth)();
function tenantCollection(tenantId, collection) {
    return exports.db.collection(`tenants/${tenantId}/${collection}`);
}
function tenantDoc(tenantId, collection, id) {
    return exports.db.doc(`tenants/${tenantId}/${collection}/${id}`);
}
//# sourceMappingURL=admin.js.map