import { Injectable } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { FirestoreCrudService } from '../../core/services/firestore-crud.service';
import { Appointment, WithId } from '../../core/models';

@Injectable({ providedIn: 'root' })
export class AppointmentService extends FirestoreCrudService<Appointment> {
  constructor() {
    super('appointments');
  }

  watchByDateRange(start: Date, end: Date): Observable<WithId<Appointment>[]> {
    return this.watchAll(
      where('start', '>=', Timestamp.fromDate(start)),
      where('start', '<', Timestamp.fromDate(end)),
      orderBy('start', 'asc'),
    );
  }

  /** Client-side overlap check for the "terapist/oda çakışma kontrolü" requirement. */
  hasOverlap(existing: WithId<Appointment>[], staffId: string, roomId: string, start: Date, end: Date, excludingId?: string): boolean {
    return existing.some((appt) => {
      if (appt.id === excludingId) return false;
      if (appt.status === 'İptal') return false;
      if (appt.staffId !== staffId && appt.roomId !== roomId) return false;

      const apptStart = appt.start instanceof Timestamp ? appt.start.toDate() : appt.start;
      const apptEnd = appt.end instanceof Timestamp ? appt.end.toDate() : appt.end;
      return start < apptEnd && end > apptStart;
    });
  }
}
