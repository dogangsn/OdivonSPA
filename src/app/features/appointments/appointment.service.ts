import { Injectable, inject } from '@angular/core';
import { Timestamp, orderBy, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { FirestoreCrudService } from '../../core/services/firestore-crud.service';
import { ApiService } from '../../core/http/api.service';
import { Appointment, WithId } from '../../core/models';

export interface SaveAppointmentInput {
  id?: string;
  customerId: string;
  staffId: string;
  roomId: string;
  serviceId: string;
  start: Date;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentService extends FirestoreCrudService<Appointment> {
  private readonly api = inject(ApiService);

  constructor() {
    super('appointments');
  }

  /** Server validates staff/room overlap and staff leave; throws with a user-facing message. */
  async save(input: SaveAppointmentInput): Promise<string> {
    const result = await this.api.post<{ id: string }>('/api/appointments', { ...input, start: input.start.toISOString() });
    return result.id;
  }

  watchByDateRange(start: Date, end: Date): Observable<WithId<Appointment>[]> {
    return this.watchAll(
      where('start', '>=', Timestamp.fromDate(start)),
      where('start', '<', Timestamp.fromDate(end)),
      orderBy('start', 'asc'),
    );
  }
}
