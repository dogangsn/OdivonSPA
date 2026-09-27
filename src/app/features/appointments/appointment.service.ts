import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiCrudService } from '../../core/services/api-crud.service';
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
export class AppointmentService extends ApiCrudService<Appointment> {
  constructor() {
    super('/spa/appointments');
  }

  /** Server validates staff/room overlap, staff leave and working hours; throws with a user-facing message. */
  async save(input: SaveAppointmentInput): Promise<string> {
    const { id, ...body } = input;
    const saved = await this.command(
      id
        ? this.api.patch<WithId<Appointment>>(`${this.path}/${id}`, body)
        : this.api.post<WithId<Appointment>>(this.path, body),
    );
    return saved.id;
  }

  /** Only status changes (confirm, arrived, no-show, cancel) are edited in place; other fields go through `save`. */
  override async update(id: string, patch: Partial<Appointment>): Promise<void> {
    await this.command(this.api.patch(`${this.path}/${id}/status`, { status: patch.status }));
  }

  watchByDateRange(start: Date, end: Date): Observable<WithId<Appointment>[]> {
    return this.watchAll({ from: start, to: end });
  }
}
