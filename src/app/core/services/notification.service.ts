import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AppointmentService } from '../../features/appointments/appointment.service';
import { ProductService } from '../../features/catalog/products/product.service';
import { TaskService } from '../../features/staff/tasks/task.service';
import { LeaveService } from '../../features/staff/leaves/leave.service';
import { CommissionAccrualService } from '../../features/finance/commissions/commission-accrual.service';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  route?: string;
}

const READ_STORAGE_KEY = 'odivon-notifications-read';

function isToday(d: Date | string): boolean {
  if (!d) return false;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly apptService = inject(AppointmentService);
  private readonly productService = inject(ProductService);
  private readonly taskService = inject(TaskService);
  private readonly leaveService = inject(LeaveService);
  private readonly accrualService = inject(CommissionAccrualService);

  private readonly appointments = this.apptService.watchAllSignal();
  private readonly products = this.productService.watchAllSignal();
  private readonly tasks = this.taskService.watchAllSignal();
  private readonly leaves = this.leaveService.watchAllSignal();
  private readonly accruals = this.accrualService.watchAllSignal();

  private readonly readIds = signal<Set<string>>(this.loadReadIds());

  readonly notifications = computed<AppNotification[]>(() => {
    const list: AppNotification[] = [];
    const readSet = this.readIds();
    const role = this.auth.role();

    // 1. Appointments (Randevular)
    const appts = this.appointments();
    const todayAppts = appts.filter((a) => a.start && isToday(a.start));
    const pendingAppts = todayAppts.filter((a) => a.status === 'Bekliyor');
    const arrivedAppts = todayAppts.filter((a) => a.status === 'Geldi');
    const confirmedAppts = todayAppts.filter((a) => a.status === 'Onaylandı');

    if (pendingAppts.length > 0) {
      const id = `appt-pending-${pendingAppts.length}`;
      list.push({
        id,
        title: 'Onay Bekleyen Randevular',
        message: `Bugün için onay bekleyen ${pendingAppts.length} adet randevu bulunuyor.`,
        time: 'Bugün',
        read: readSet.has(id),
        type: 'warning',
        route: '/randevular',
      });
    }

    if (arrivedAppts.length > 0) {
      const id = `appt-arrived-${arrivedAppts.length}`;
      list.push({
        id,
        title: 'Salonda Bekleyen Müşteri',
        message: `${arrivedAppts.length} müşteri salona giriş yaptı, seans başlatılabilir.`,
        time: 'Bugün',
        read: readSet.has(id),
        type: 'info',
        route: '/randevular',
      });
    }

    if (confirmedAppts.length > 0) {
      const id = `appt-confirmed-${confirmedAppts.length}`;
      list.push({
        id,
        title: 'Bugünkü Seans Akışı',
        message: `Bugün için planlanan ${confirmedAppts.length} seans randevusu mevcut.`,
        time: 'Bugün',
        read: readSet.has(id),
        type: 'info',
        route: '/randevular',
      });
    }

    // 2. Critical Stock / Low Inventory (Kritik Stok Uyarısı)
    const prods = this.products().filter((p) => (p.active !== false && (p as any).aktif !== false));
    const lowStock = prods.filter((p) => (p.mevcutStok ?? 0) <= (p.kritikStokSeviyesi || 5));

    if (lowStock.length === 1) {
      const p = lowStock[0];
      const id = `stock-low-${p.id}-${p.mevcutStok}`;
      list.push({
        id,
        title: 'Kritik Stok Uyarısı',
        message: `"${p.ad}" stok miktarı kritik seviyede (Kalan: ${p.mevcutStok ?? 0} adet).`,
        time: 'Stok',
        read: readSet.has(id),
        type: 'error',
        route: '/katalog/urunler',
      });
    } else if (lowStock.length > 1) {
      const id = `stock-low-multiple-${lowStock.length}`;
      list.push({
        id,
        title: 'Kritik Stok Seviyesi',
        message: `${lowStock.length} adet ürün kritik stok seviyesine ulaştı. Sipariş planlayın.`,
        time: 'Stok',
        read: readSet.has(id),
        type: 'error',
        route: '/katalog/urunler',
      });
    }

    // 3. High Priority & Open Tasks (Öncelikli Görevler)
    const openTasks = this.tasks().filter((t) => t.status === 'acik' || t.status === 'devam');
    const highPriorityTasks = openTasks.filter((t) => t.priority === 'yuksek');

    if (highPriorityTasks.length > 0) {
      const id = `task-high-${highPriorityTasks.length}`;
      list.push({
        id,
        title: 'Öncelikli Operasyon Görevi',
        message: `Takip edilmesi gereken ${highPriorityTasks.length} adet yüksek öncelikli görev mevcut.`,
        time: 'Görev',
        read: readSet.has(id),
        type: 'warning',
        route: '/personel/gorevler',
      });
    } else if (openTasks.length > 0) {
      const id = `tasks-open-${openTasks.length}`;
      list.push({
        id,
        title: 'Açık Görevler',
        message: `Ekip için tanımlı ${openTasks.length} adet tamamlanmamış görev bulunuyor.`,
        time: 'Görev',
        read: readSet.has(id),
        type: 'info',
        route: '/personel/gorevler',
      });
    }

    // 4. Staff Leaves & Commissions (Admin Only)
    if (role === 'admin') {
      const pendingLeaves = this.leaves().filter((l) => l.status === 'beklemede');
      if (pendingLeaves.length > 0) {
        const id = `leaves-pending-${pendingLeaves.length}`;
        list.push({
          id,
          title: 'Onay Bekleyen İzin Talebi',
          message: `${pendingLeaves.length} personel izin talebi yönetici onayı bekliyor.`,
          time: 'İzin',
          read: readSet.has(id),
          type: 'warning',
          route: '/personel/izinler',
        });
      }

      const pendingAccruals = this.accruals().filter((a) => a.status === 'pending');
      if (pendingAccruals.length > 0) {
        const id = `accruals-pending-${pendingAccruals.length}`;
        const totalAmount = pendingAccruals.reduce((sum, a) => sum + (a.amount || 0), 0);
        list.push({
          id,
          title: 'Bekleyen Prim Tahakkuku',
          message: `${pendingAccruals.length} adet seans prim tahakkuku (₺${totalAmount.toFixed(2)}) ödeme bekliyor.`,
          time: 'Finans',
          read: readSet.has(id),
          type: 'info',
          route: '/finans/primler',
        });
      }
    }

    // 5. Default when no operational alerts
    if (list.length === 0) {
      list.push({
        id: 'sys-online-ready',
        title: 'Sistem Çevrimiçi',
        message: 'Tüm spa servisleri ve bulut senkronizasyonu aktif. Bekleyen aksiyon bulunmuyor.',
        time: 'Canlı',
        read: true,
        type: 'success',
        route: '/panel',
      });
    }

    return list;
  });

  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  markAllAsRead(): void {
    const current = this.notifications();
    const newSet = new Set(this.readIds());
    for (const item of current) {
      newSet.add(item.id);
    }
    this.readIds.set(newSet);
    this.saveReadIds(newSet);
  }

  markAsRead(id: string): void {
    const newSet = new Set(this.readIds());
    newSet.add(id);
    this.readIds.set(newSet);
    this.saveReadIds(newSet);
  }

  private loadReadIds(): Set<string> {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(READ_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return new Set(parsed);
          }
        }
      }
    } catch {}
    return new Set();
  }

  private saveReadIds(set: Set<string>): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(set)));
      }
    } catch {}
  }
}
