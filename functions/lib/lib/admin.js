"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldValue = exports.auth = exports.db = void 0;
exports.tenantCollection = tenantCollection;
exports.tenantDoc = tenantDoc;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
Object.defineProperty(exports, "FieldValue", { enumerable: true, get: function () { return firestore_1.FieldValue; } });
const auth_1 = require("firebase-admin/auth");
(0, app_1.initializeApp)();
exports.db = (0, firestore_1.getFirestore)();
exports.auth = (0, auth_1.getAuth)();
function tenantCollection(tenantId, collection) {
    return exports.db.collection(`tenants/${tenantId}/${collection}`);
}
function tenantDoc(tenantId, collection, id) {
    return exports.db.doc(`tenants/${tenantId}/${collection}/${id}`);
}
//# sourceMappingURL=admin.js.map