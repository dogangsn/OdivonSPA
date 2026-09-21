import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { db, FieldValue } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';

interface SaveAppointmentData {
  id?: string;
  customerId: string;
  staffId: string;
  roomId: string;
  serviceId: string;
  start: string; // ISO instant
  notes?: string;
}

const MAX_APPOINTMENT_MS = 12 * 60 * 60 * 1000;

/** Creates/updates an appointment with server-side staff/room overlap and staff-leave checks. */
export const saveAppointment = onCall<SaveAppointmentData>({ region: 'europe-west1' }, async (request) => {
  const ctx = requireTenantAuth(request, ['admin', 'reception']);
  const data = request.data;
  if (!data?.customerId || !data.staffId || !data.roomId || !data.serviceId || !data.start) {
    throw new HttpsError('invalid-argument', 'Müşteri, terapist, oda, hizmet ve saat zorunludur.');
  }
  const start = new Date(data.start);
  if (Number.isNaN(start.getTime())) throw new HttpsError('invalid-argument', 'Geçersiz başlangıç zamanı.');

  const root = db.collection('tenants').doc(ctx.tenantId);

  const id = await db.runTransaction(async (tx) => {
    const [serviceSnap, staffSnap, roomSnap, customerSnap] = await Promise.all([
      tx.get(root.collection('services').doc(data.serviceId)),
      tx.get(root.collection('staff').doc(data.staffId)),
      tx.get(root.collection('rooms').doc(data.roomId)),
      tx.get(root.collection('customers').doc(data.customerId)),
    ]);
    if (!serviceSnap.exists || !staffSnap.exists || !roomSnap.exists || !customerSnap.exists) {
      throw new HttpsError('not-found', 'Müşteri, terapist, oda veya hizmet bulunamadı.');
    }
    if (!staffSnap.data()?.['active'] || !roomSnap.data()?.['active']) {
      throw new HttpsError('failed-precondition', 'Terapist veya oda aktif değil.');
    }

    const end = new Date(start.getTime() + (serviceSnap.data()!['sureDk'] as number) * 60000);

    const windowStart = Timestamp.fromDate(new Date(start.getTime() - MAX_APPOINTMENT_MS));
    const windowEnd = Timestamp.fromDate(end);
    const [staffAppts, roomAppts, leaves] = await Promise.all([
      tx.get(root.collection('appointments').where('staffId', '==', data.staffId).where('start', '>=', windowStart).where('start', '<', windowEnd)),
      tx.get(root.collection('appointments').where('roomId', '==', data.roomId).where('start', '>=', windowStart).where('start', '<', windowEnd)),
      tx.get(root.collection('staffLeaves').where('staffId', '==', data.staffId)),
    ]);

    const overlaps = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) =>
      docs.some((d) => {
        if (d.id === data.id) return false;
        const a = d.data() as { status: string; start: Timestamp; end: Timestamp };
        return a.status !== 'İptal' && start < a.end.toDate() && end > a.start.toDate();
      });

    if (overlaps(staffAppts.docs)) throw new HttpsError('failed-precondition', 'Terapistin bu saatte başka randevusu var.');
    if (overlaps(roomAppts.docs)) throw new HttpsError('failed-precondition', 'Oda bu saatte dolu.');

    const onLeave = leaves.docs.some((d) => {
      const l = d.data() as { startDate: Timestamp; endDate: Timestamp };
      const leaveEnd = new Date(l.endDate.toDate().getTime() + 24 * 60 * 60 * 1000); // end date is inclusive
      return start < leaveEnd && end > l.startDate.toDate();
    });
    if (onLeave) throw new HttpsError('failed-precondition', 'Terapist bu tarihte izinli.');

    const payload = {
      customerId: data.customerId,
      staffId: data.staffId,
      roomId: data.roomId,
      serviceId: data.serviceId,
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
      notes: data.notes ?? null,
    };

    if (data.id) {
      const ref = root.collection('appointments').doc(data.id);
      if (!(await tx.get(ref)).exists) throw new HttpsError('not-found', 'Randevu bulunamadı.');
      tx.update(ref, { ...payload, updatedAt: FieldValue.serverTimestamp(), updatedBy: ctx.uid });
      return data.id;
    }
    const ref = root.collection('appointments').doc();
    tx.set(ref, { ...payload, status: 'Bekliyor', createdAt: FieldValue.serverTimestamp(), createdBy: ctx.uid });
    return ref.id;
  });

  await writeAuditLog({
    tenantId: ctx.tenantId,
    entity: 'appointments',
    action: 'callable',
    entityId: id,
    after: { staffId: data.staffId, roomId: data.roomId, start: data.start },
    actor: ctx,
  });

  return { id };
});
