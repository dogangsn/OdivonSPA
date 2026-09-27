import { Router } from 'express';
import { QueryDocumentSnapshot, Timestamp } from 'firebase-admin/firestore';
import { db, FieldValue } from '../lib/admin';
import { requireTenantAuth } from '../lib/context';
import { writeAuditLog } from '../lib/audit';
import { ApiError, asyncHandler } from '../lib/errors';
import { getTenantSchedule, workHoursViolation } from '../lib/time';

export const appointmentsRouter = Router();

interface SaveAppointmentBody {
  id?: string;
  customerId: string;
  staffId: string;
  roomId: string;
  serviceId: string;
  start: string; // ISO instant
  notes?: string;
}

const MAX_APPOINTMENT_MS = 12 * 60 * 60 * 1000;
const OPEN_STATUSES = ['Bekliyor', 'Onaylandı', 'Geldi'];
/** Small grace so a booking made "now" from a slow form isn't rejected as being in the past. */
const PAST_GRACE_MS = 5 * 60 * 1000;

/** Creates/updates an appointment with server-side staff/room overlap and staff-leave checks. */
appointmentsRouter.post(
  '/appointments',
  asyncHandler(async (req, res) => {
    const ctx = requireTenantAuth(req, ['admin', 'reception']);
    const data = req.body as SaveAppointmentBody;
    if (!data?.customerId || !data.staffId || !data.roomId || !data.serviceId || !data.start) {
      throw new ApiError('invalid-argument', 'Müşteri, terapist, oda, hizmet ve saat zorunludur.');
    }
    const start = new Date(data.start);
    if (Number.isNaN(start.getTime())) throw new ApiError('invalid-argument', 'Geçersiz başlangıç zamanı.');

    const root = db.collection('tenants').doc(ctx.tenantId);
    const schedule = await getTenantSchedule(ctx.tenantId);

    const id = await db.runTransaction(async (tx) => {
      const existingRef = data.id ? root.collection('appointments').doc(data.id) : null;
      const existing = existingRef ? await tx.get(existingRef) : null;
      if (existing && !existing.exists) throw new ApiError('not-found', 'Randevu bulunamadı.');
      if (existing && !OPEN_STATUSES.includes(existing.data()?.['status'])) {
        throw new ApiError('failed-precondition', 'Tamamlanan, iptal edilen veya gelinmeyen randevu düzenlenemez.');
      }
      // Editing notes on an appointment that has already started must not trip the past-time check.
      const startUnchanged = existing && (existing.data()?.['start'] as Timestamp).toMillis() === start.getTime();
      if (!startUnchanged && start.getTime() < Date.now() - PAST_GRACE_MS) {
        throw new ApiError('failed-precondition', 'Geçmiş bir saate randevu verilemez.');
      }

      const [serviceSnap, staffSnap, roomSnap, customerSnap] = await Promise.all([
        tx.get(root.collection('services').doc(data.serviceId)),
        tx.get(root.collection('staff').doc(data.staffId)),
        tx.get(root.collection('rooms').doc(data.roomId)),
        tx.get(root.collection('customers').doc(data.customerId)),
      ]);
      if (!serviceSnap.exists || !staffSnap.exists || !roomSnap.exists || !customerSnap.exists) {
        throw new ApiError('not-found', 'Müşteri, terapist, oda veya hizmet bulunamadı.');
      }
      if (!staffSnap.data()?.['active'] || !roomSnap.data()?.['active']) {
        throw new ApiError('failed-precondition', 'Terapist veya oda aktif değil.');
      }
      if (customerSnap.data()?.['active'] === false) {
        throw new ApiError('failed-precondition', 'Müşteri pasif durumda.');
      }
      if (serviceSnap.data()?.['active'] === false) {
        throw new ApiError('failed-precondition', 'Hizmet aktif değil.');
      }

      const end = new Date(start.getTime() + (serviceSnap.data()!['sureDk'] as number) * 60000);
      const outsideHours = startUnchanged ? null : workHoursViolation(start, end, schedule);
      if (outsideHours) throw new ApiError('failed-precondition', outsideHours);

      const windowStart = Timestamp.fromDate(new Date(start.getTime() - MAX_APPOINTMENT_MS));
      const windowEnd = Timestamp.fromDate(end);
      const [staffAppts, roomAppts, leaves] = await Promise.all([
        tx.get(root.collection('appointments').where('staffId', '==', data.staffId).where('start', '>=', windowStart).where('start', '<', windowEnd)),
        tx.get(root.collection('appointments').where('roomId', '==', data.roomId).where('start', '>=', windowStart).where('start', '<', windowEnd)),
        tx.get(root.collection('staffLeaves').where('staffId', '==', data.staffId)),
      ]);

      const overlaps = (docs: QueryDocumentSnapshot[]) =>
        docs.some((d) => {
          if (d.id === data.id) return false;
          const a = d.data() as { status: string; start: Timestamp; end: Timestamp };
          return a.status !== 'İptal' && start < a.end.toDate() && end > a.start.toDate();
        });

      if (overlaps(staffAppts.docs)) throw new ApiError('failed-precondition', 'Terapistin bu saatte başka randevusu var.');
      if (overlaps(roomAppts.docs)) throw new ApiError('failed-precondition', 'Oda bu saatte dolu.');

      const onLeave = leaves.docs.some((d) => {
        const l = d.data() as { startDate: Timestamp; endDate: Timestamp; status?: string };
        // Pending/rejected requests don't block; records from before approval existed have no status.
        if (l.status && l.status !== 'onaylandi') return false;
        const leaveEnd = new Date(l.endDate.toDate().getTime() + 24 * 60 * 60 * 1000); // end date is inclusive
        return start < leaveEnd && end > l.startDate.toDate();
      });
      if (onLeave) throw new ApiError('failed-precondition', 'Terapist bu tarihte izinli.');

      const payload = {
        customerId: data.customerId,
        staffId: data.staffId,
        roomId: data.roomId,
        serviceId: data.serviceId,
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
        notes: data.notes ?? null,
      };

      if (existingRef) {
        tx.update(existingRef, { ...payload, updatedAt: FieldValue.serverTimestamp(), updatedBy: ctx.uid });
        return existingRef.id;
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

    res.json({ id });
  }),
);
