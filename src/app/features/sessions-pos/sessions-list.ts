import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EmptyState } from '../../core/ui/empty-state/empty-state';
import { KpiCard } from '../../core/ui/kpi-card/kpi-card';
import { FirestoreDatePipe } from '../../core/pipes/firestore-date.pipe';
import { PAYMENT_METHOD_LABELS } from '../../core/models';
import { SessionService } from './session.service';
import { CustomerService } from '../customers/customer.service';
import { StaffService } from '../staff/personnel/staff.service';
import { ListWindow, LoadMore } from '../../core/ui/load-more/load-more';

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [KpiCard, RouterLink, DecimalPipe, FirestoreDatePipe, MatIconModule, EmptyState, LoadMore],
  templateUrl: './sessions-list.html',
})
export class SessionsList {
  private readonly sessionService = inject(SessionService);
  private readonly customerService = inject(CustomerService);
  private readonly staffService = inject(StaffService);

  readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  readonly listWindow = new ListWindow();
  readonly sessions = this.sessionService.watchRecentSignal(this.listWindow.count);
  readonly hasMore = this.listWindow.hasMore(this.sessions);
  private readonly customers = this.customerService.watchAllSignal();
  private readonly staff = this.staffService.watchAllSignal();

  readonly customerNameById = computed(() => new Map(this.customers().map((c) => [c.id, c.ad])));
  readonly staffNameById = computed(() => new Map(this.staff().map((s) => [s.id, s.ad])));

  readonly searchQuery = signal('');
  readonly filteredSessions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.sessions();
    const customers = this.customerNameById();
    const staff = this.staffNameById();
    return this.sessions().filter(
      (s) =>
        s.receiptNo.toLowerCase().includes(query) ||
        (customers.get(s.customerId) ?? '').toLowerCase().includes(query) ||
        (staff.get(s.staffId) ?? '').toLowerCase().includes(query),
    );
  });
  readonly totals = computed(() => {
    const list = this.filteredSessions();
    const revenue = list.reduce((sum, s) => sum + s.totalAmount, 0);
    return {
      revenue,
      discount: list.reduce((sum, s) => sum + s.discountAmount, 0),
      average: list.length ? revenue / list.length : 0,
    };
  });

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }
}
