"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAppointment = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin_1 = require("../lib/admin");
const context_1 = require("../lib/context");
const audit_1 = require("../lib/audit");
const MAX_APPOINTMENT_MS = 12 * 60 * 60 * 1000;
/** Creates/updates an appointment with server-side staff/room overlap and staff-leave checks. */
exports.saveAppointment = (0, https_1.onCall)({ region: 'europe-west1' }, async (request) => {
    const ctx = (0, context_1.requireTenantAuth)(request, ['admin', 'reception']);
    const data = request.data;
    if (!data?.customerId || !data.staffId || !data.roomId || !data.serviceId || !data.start) {
        throw new https_1.HttpsError('invalid-argument', 'Müşteri, terapist, oda, hizmet ve saat zorunludur.');
    }
    const start = new Date(data.start);
    if (Number.isNaN(start.getTime()))
        throw new https_1.HttpsError('invalid-argument', 'Geçersiz başlangıç zamanı.');
    const root = admin_1.db.collection('tenants').doc(ctx.tenantId);
    const id = await admin_1.db.runTransaction(async (tx) => {
        const [serviceSnap, staffSnap, roomSnap, customerSnap] = await Promise.all([
            tx.get(root.collection('services').doc(data.serviceId)),
            tx.get(root.collection('staff').doc(data.staffId)),
            tx.get(root.collection('rooms').doc(data.roomId)),
            tx.get(root.collection('customers').doc(data.customerId)),
        ]);
        if (!serviceSnap.exists || !staffSnap.exists || !roomSnap.exists || !customerSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Müşteri, terapist, oda veya hizmet bulunamadı.');
        }
        if (!staffSnap.data()?.['active'] || !roomSnap.data()?.['active']) {
            throw new https_1.HttpsError('failed-precondition', 'Terapist veya oda aktif değil.');
        }
        const end = new Date(start.getTime() + serviceSnap.data()['sureDk'] * 60000);
        const windowStart = firestore_1.Timestamp.fromDate(new Date(start.getTime() - MAX_APPOINTMENT_MS));
        const windowEnd = firestore_1.Timestamp.fromDate(end);
        const [staffAppts, roomAppts, leaves] = await Promise.all([
            tx.get(root.collection('appointments').where('staffId', '==', data.staffId).where('start', '>=', windowStart).where('start', '<', windowEnd)),
            tx.get(root.collection('appointments').where('roomId', '==', data.roomId).where('start', '>=', windowStart).where('start', '<', windowEnd)),
            tx.get(root.collection('staffLeaves').where('staffId', '==', data.staffId)),
        ]);
        const overlaps = (docs) => docs.some((d) => {
            if (d.id === data.id)
                return false;
            const a = d.data();
            return a.status !== 'İptal' && start < a.end.toDate() && end > a.start.toDate();
        });
        if (overlaps(staffAppts.docs))
            throw new https_1.HttpsError('failed-precondition', 'Terapistin bu saatte başka randevusu var.');
        if (overlaps(roomAppts.docs))
            throw new https_1.HttpsError('failed-precondition', 'Oda bu saatte dolu.');
        const onLeave = leaves.docs.some((d) => {
            const l = d.data();
            const leaveEnd = new Date(l.endDate.toDate().getTime() + 24 * 60 * 60 * 1000); // end date is inclusive
            return start < leaveEnd && end > l.startDate.toDate();
        });
        if (onLeave)
            throw new https_1.HttpsError('failed-precondition', 'Terapist bu tarihte izinli.');
        const payload = {
            customerId: data.customerId,
            staffId: data.staffId,
            roomId: data.roomId,
            serviceId: data.serviceId,
            start: firestore_1.Timestamp.fromDate(start),
            end: firestore_1.Timestamp.fromDate(end),
            notes: data.notes ?? null,
        };
        if (data.id) {
            const ref = root.collection('appointments').doc(data.id);
            if (!(await tx.get(ref)).exists)
                throw new https_1.HttpsError('not-found', 'Randevu bulunamadı.');
            tx.update(ref, { ...payload, updatedAt: admin_1.FieldValue.serverTimestamp(), updatedBy: ctx.uid });
            return data.id;
        }
        const ref = root.collection('appointments').doc();
        tx.set(ref, { ...payload, status: 'Bekliyor', createdAt: admin_1.FieldValue.serverTimestamp(), createdBy: ctx.uid });
        return ref.id;
    });
    await (0, audit_1.writeAuditLog)({
        tenantId: ctx.tenantId,
        entity: 'appointments',
        action: 'callable',
        entityId: id,
        after: { staffId: data.staffId, roomId: data.roomId, start: data.start },
        actor: ctx,
    });
    return { id };
});
//# sourceMappingURL=save-appointment.js.map