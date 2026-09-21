import { Component, DestroyRef, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import { AuthService } from '../../core/auth/auth.service';
import { FirestoreDatePipe } from '../../core/pipes/firestore-date.pipe';
import { PAYMENT_METHOD_LABELS } from '../../core/models';
import { SessionService } from './session.service';
import { CustomerService } from '../customers/customer.service';
import { StaffService } from '../staff/personnel/staff.service';

/** 80mm thermal-style receipt. `body.print-receipt` (see styles.scss) hides everything but `.receipt-print`. */
@Component({
  selector: 'app-session-receipt',
  standalone: true,
  imports: [RouterLink, DecimalPipe, FirestoreDatePipe],
  template: `
    <div class="flex items-center gap-3 mb-4 print:hidden">
      <a routerLink="/seanslar" class="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">← Seanslar</a>
      <button type="button" (click)="print()" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">Yazdır</button>
    </div>

    @if (session(); as s) {
      <div class="receipt-print mx-auto bg-white text-black p-4 font-mono text-[12px] leading-snug" style="width: 80mm">
        <div class="text-center font-bold text-sm">{{ tenantName() }}</div>
        <div class="text-center">Seans Fişi</div>
        <div class="border-t border-dashed border-black my-2"></div>
        <div>Fiş No : {{ s.receiptNo }}</div>
        <div>Tarih  : {{ s.createdAt | fsDate: 'dd.MM.yyyy HH:mm' }}</div>
        <div>Müşteri: {{ customerName() }}</div>
        <div>Terapist: {{ staffName() }}</div>
        <div class="border-t border-dashed border-black my-2"></div>
        @for (item of s.items; track $index) {
          <div class="flex justify-between gap-2">
            <span>{{ item.qty }} x {{ item.ad }}</span>
            <span>{{ item.customerPackageId ? 'Paket' : (item.price * item.qty - item.discount | number: '1.2-2') }}</span>
          </div>
        }
        <div class="border-t border-dashed border-black my-2"></div>
        @if (s.discountAmount > 0) {
          <div class="flex justify-between"><span>İndirim</span><span>-{{ s.discountAmount | number: '1.2-2' }}</span></div>
        }
        <div class="flex justify-between font-bold text-sm"><span>TOPLAM</span><span>₺{{ s.totalAmount | number: '1.2-2' }}</span></div>
        @for (p of s.payments; track p.method) {
          <div class="flex justify-between"><span>{{ methodLabels[p.method] }}</span><span>{{ p.amount | number: '1.2-2' }}</span></div>
        }
        <div class="border-t border-dashed border-black my-2"></div>
        <div class="text-center">Teşekkür ederiz</div>
      </div>
    } @else {
      <p class="text-sm text-slate-400">Fiş yükleniyor…</p>
    }
  `,
})
export class SessionReceipt {
  private readonly sessionService = inject(SessionService);
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(Firestore);
  private readonly customers = inject(CustomerService).watchAllSignal();
  private readonly staff = inject(StaffService).watchAllSignal();

  readonly methodLabels = PAYMENT_METHOD_LABELS;
  readonly id = input.required<string>();

  readonly session = toSignal(toObservable(this.id).pipe(switchMap((id) => this.sessionService.watchOne(id))), { initialValue: undefined });

  private readonly tenant = toSignal(
    docData(doc(this.firestore, `tenants/${this.auth.tenantId()}`)),
    { initialValue: undefined },
  );
  readonly tenantName = computed(() => (this.tenant() as { name?: string } | undefined)?.name ?? 'OdivonSPA');
  readonly customerName = computed(() => this.customers().find((c) => c.id === this.session()?.customerId)?.ad ?? '—');
  readonly staffName = computed(() => this.staff().find((s) => s.id === this.session()?.staffId)?.ad ?? '—');

  constructor() {
    document.body.classList.add('print-receipt');
    inject(DestroyRef).onDestroy(() => document.body.classList.remove('print-receipt'));
  }

  print(): void {
    window.print();
  }
}
