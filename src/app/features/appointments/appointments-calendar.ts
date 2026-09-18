import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Timestamp } from '@angular/fire/firestore';
import { MatIconModule } from '@angular/material/icon';
import { SlideOverDrawer } from '../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../core/ui/confirm/confirm.service';
import {
  APPOINTMENT_STATUS_BADGE,
  APPOINTMENT_STATUS_FLOW,
  Appointment,
  AppointmentStatus,
  WithId,
} from '../../core/models';
import { AppointmentService } from './appointment.service';
import { StaffService } from '../staff/personnel/staff.service';
import { RoomService } from '../catalog/rooms/room.service';
import { CatalogServiceService } from '../catalog/services/catalog-service.service';
import { CustomerService } from '../customers/customer.service';

const START_HOUR = 8;
const END_HOUR = 22;
const SLOT_MINUTES = 30;
const ROW_HEIGHT_PX = 56;

interface BookingForm {
  customerId: string;
  staffId: string;
  roomId: string;
  serviceId: string;
  time: string; // "HH:mm"
  notes: string;
}

const EMPTY_BOOKING: BookingForm = { customerId: '', staffId: '', roomId: '', serviceId: '', time: '09:00', notes: '' };

@Component({
  selector: 'app-appointments-calendar',
  standalone: true,
  imports: [FormsModule, DatePipe, MatIconModule, SlideOverDrawer, StatusBadge],
  templateUrl: './appointments-calendar.html',
})
export class AppointmentsCalendar {
  private readonly appointmentService = inject(AppointmentService);
  private readonly staffService = inject(StaffService);
  private readonly roomService = inject(RoomService);
  private readonly serviceService = inject(CatalogServiceService);
  private readonly customerService = inject(CustomerService);
  private readonly confirmService = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly statusBadge = APPOINTMENT_STATUS_BADGE;
  readonly statusFlow = APPOINTMENT_STATUS_FLOW;

  readonly selectedDate = signal(startOfDay(new Date()));
  readonly viewMode = signal<'staff' | 'room'>('staff');

  readonly filterStaffId = signal('');
  readonly filterRoomId = signal('');
  readonly filterServiceId = signal('');
  readonly filterStatus = signal<AppointmentStatus | ''>('');

  private readonly allStaff = this.staffService.watchAllSignal();
  private readonly allRooms = this.roomService.watchAllSignal();
  private readonly allServices = this.serviceService.watchAllSignal();
  readonly customers = this.customerService.watchAllSignal();

  readonly staff = computed(() => this.allStaff().filter((s) => s.active && s.role === 'therapist'));
  readonly rooms = computed(() => this.allRooms().filter((r) => r.active));
  readonly services = computed(() => this.allServices().filter((s) => s.active));

  readonly appointmentsOfDay = toSignal(
    toObservable(this.selectedDate).pipe(
      switchMap((date) => this.appointmentService.watchByDateRange(date, addDays(date, 1))),
    ),
    { initialValue: [] as WithId<Appointment>[] },
  );

  readonly filteredAppointments = computed(() =>
    this.appointmentsOfDay().filter(
      (a) =>
        (!this.filterStaffId() || a.staffId === this.filterStaffId()) &&
        (!this.filterRoomId() || a.roomId === this.filterRoomId()) &&
        (!this.filterServiceId() || a.serviceId === this.filterServiceId()) &&
        (!this.filterStatus() || a.status === this.filterStatus()),
    ),
  );

  readonly columns = computed(() =>
    this.viewMode() === 'staff'
      ? this.staff().map((s) => ({ id: s.id, label: s.ad, color: s.renk }))
      : this.rooms().map((r) => ({ id: r.id, label: r.ad, color: '#6366f1' })),
  );

  readonly timeSlots = buildTimeSlots();
  readonly gridHeight = this.timeSlots.length * ROW_HEIGHT_PX;

  customerNameById = computed(() => new Map(this.customers().map((c) => [c.id, c.ad])));
  staffNameById = computed(() => new Map(this.allStaff().map((s) => [s.id, s.ad])));
  roomNameById = computed(() => new Map(this.allRooms().map((r) => [r.id, r.ad])));
  serviceById = computed(() => new Map(this.allServices().map((s) => [s.id, s])));

  appointmentsForColumn(columnId: string) {
    const key = this.viewMode() === 'staff' ? 'staffId' : 'roomId';
    return this.filteredAppointments().filter((a) => a[key] === columnId);
  }

  cardStyle(appt: WithId<Appointment>): { top: string; height: string } {
    const start = asDate(appt.start);
    const end = asDate(appt.end);
    const minutesFromStart = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const durationMin = Math.max(15, (end.getTime() - start.getTime()) / 60000);
    return {
      top: `${(minutesFromStart / SLOT_MINUTES) * ROW_HEIGHT_PX}px`,
      height: `${(durationMin / SLOT_MINUTES) * ROW_HEIGHT_PX - 4}px`,
    };
  }

  formatTimeRange(appt: WithId<Appointment>): string {
    return `${formatTime(asDate(appt.start))} – ${formatTime(asDate(appt.end))}`;
  }

  prevDay(): void {
    this.selectedDate.set(addDays(this.selectedDate(), -1));
  }

  nextDay(): void {
    this.selectedDate.set(addDays(this.selectedDate(), 1));
  }

  today(): void {
    this.selectedDate.set(startOfDay(new Date()));
  }

  resetFilters(): void {
    this.filterStaffId.set('');
    this.filterRoomId.set('');
    this.filterServiceId.set('');
    this.filterStatus.set('');
  }

  // ---- Booking drawer ----
  readonly bookingDrawerOpen = signal(false);
  readonly isEditingBooking = signal(false);
  readonly editingBookingId = signal<string | null>(null);
  readonly bookingSaving = signal(false);
  bookingForm: BookingForm = { ...EMPTY_BOOKING };

  openCreateBooking(prefillStaffId?: string): void {
    this.isEditingBooking.set(false);
    this.editingBookingId.set(null);
    this.bookingForm = { ...EMPTY_BOOKING, staffId: prefillStaffId ?? '', roomId: this.rooms()[0]?.id ?? '' };
    this.bookingDrawerOpen.set(true);
  }

  openEditBooking(appt: WithId<Appointment>): void {
    this.closeDetailDrawer();
    this.isEditingBooking.set(true);
    this.editingBookingId.set(appt.id);
    this.bookingForm = {
      customerId: appt.customerId,
      staffId: appt.staffId,
      roomId: appt.roomId,
      serviceId: appt.serviceId,
      time: formatTime(asDate(appt.start)),
      notes: appt.notes ?? '',
    };
    this.bookingDrawerOpen.set(true);
  }

  closeBookingDrawer(): void {
    this.bookingDrawerOpen.set(false);
  }

  async saveBooking(): Promise<void> {
    const { customerId, staffId, roomId, serviceId, time } = this.bookingForm;
    const service = this.serviceById().get(serviceId);
    if (!customerId || !staffId || !roomId || !service) return;

    const [hh, mm] = time.split(':').map(Number);
    const start = new Date(this.selectedDate());
    start.setHours(hh, mm, 0, 0);
    const end = new Date(start.getTime() + service.sureDk * 60000);

    if (this.appointmentService.hasOverlap(this.appointmentsOfDay(), staffId, roomId, start, end, this.editingBookingId() ?? undefined)) {
      await this.confirmService.error('Çakışma Bulundu', 'Seçilen terapist veya oda bu saatte dolu.');
      return;
    }

    this.bookingSaving.set(true);
    try {
      const payload = {
        customerId,
        staffId,
        roomId,
        serviceId,
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
        notes: this.bookingForm.notes.trim() || undefined,
      };
      if (this.isEditingBooking() && this.editingBookingId()) {
        await this.appointmentService.update(this.editingBookingId()!, payload);
      } else {
        await this.appointmentService.create({ ...payload, status: 'Bekliyor' } as Omit<Appointment, 'id'>);
      }
      this.closeBookingDrawer();
    } finally {
      this.bookingSaving.set(false);
    }
  }

  // ---- Detail / status drawer ----
  readonly detailAppointment = signal<WithId<Appointment> | null>(null);

  openDetail(appt: WithId<Appointment>): void {
    this.detailAppointment.set(appt);
  }

  closeDetailDrawer(): void {
    this.detailAppointment.set(null);
  }

  nextStatus(appt: WithId<Appointment>): AppointmentStatus | null {
    const idx = this.statusFlow.indexOf(appt.status);
    return idx >= 0 && idx < this.statusFlow.length - 1 ? this.statusFlow[idx + 1] : null;
  }

  async advanceStatus(appt: WithId<Appointment>): Promise<void> {
    const next = this.nextStatus(appt);
    if (!next) return;
    await this.appointmentService.update(appt.id, { status: next });
    this.detailAppointment.set({ ...appt, status: next });
  }

  async markStatus(appt: WithId<Appointment>, status: AppointmentStatus): Promise<void> {
    const confirmed = await this.confirmService.confirm({ title: `Randevuyu "${status}" Olarak İşaretle`, text: 'Bu işlemi onaylıyor musunuz?' });
    if (!confirmed) return;
    await this.appointmentService.update(appt.id, { status });
    this.closeDetailDrawer();
  }

  convertToSession(appt: WithId<Appointment>): void {
    this.closeDetailDrawer();
    this.router.navigate(['/seanslar/yeni'], {
      queryParams: { appointmentId: appt.id, customerId: appt.customerId, staffId: appt.staffId, roomId: appt.roomId },
    });
  }
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function asDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let minutes = START_HOUR * 60; minutes < END_HOUR * 60; minutes += SLOT_MINUTES) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }
  return slots;
}
