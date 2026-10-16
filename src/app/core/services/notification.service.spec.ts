import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NotificationService } from './notification.service';
import { AuthService } from '../auth/auth.service';
import { AppointmentService } from '../../features/appointments/appointment.service';
import { ProductService } from '../../features/catalog/products/product.service';
import { TaskService } from '../../features/staff/tasks/task.service';
import { LeaveService } from '../../features/staff/leaves/leave.service';
import { CommissionAccrualService } from '../../features/finance/commissions/commission-accrual.service';

describe('NotificationService', () => {
  let service: NotificationService;
  const mockRole = signal<'admin' | 'staff'>('admin');
  const mockAppts = signal<any[]>([]);
  const mockProducts = signal<any[]>([]);
  const mockTasks = signal<any[]>([]);
  const mockLeaves = signal<any[]>([]);
  const mockAccruals = signal<any[]>([]);

  beforeEach(() => {
    mockRole.set('admin');
    mockAppts.set([]);
    mockProducts.set([]);
    mockTasks.set([]);
    mockLeaves.set([]);
    mockAccruals.set([]);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('odivon-notifications-read');
      } catch {}
    }

    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        {
          provide: AuthService,
          useValue: {
            role: mockRole,
            user: signal({ email: 'admin@odivon.com' }),
          },
        },
        {
          provide: AppointmentService,
          useValue: {
            watchAllSignal: () => mockAppts,
          },
        },
        {
          provide: ProductService,
          useValue: {
            watchAllSignal: () => mockProducts,
          },
        },
        {
          provide: TaskService,
          useValue: {
            watchAllSignal: () => mockTasks,
          },
        },
        {
          provide: LeaveService,
          useValue: {
            watchAllSignal: () => mockLeaves,
          },
        },
        {
          provide: CommissionAccrualService,
          useValue: {
            watchAllSignal: () => mockAccruals,
          },
        },
      ],
    });

    service = TestBed.inject(NotificationService);
  });

  it('should be created and show default system online notification when no alerts exist', () => {
    expect(service).toBeTruthy();
    const notifs = service.notifications();
    expect(notifs.length).toBe(1);
    expect(notifs[0].id).toBe('sys-online-ready');
    expect(notifs[0].read).toBe(true);
    expect(service.unreadCount()).toBe(0);
  });

  it('should generate appointment notification for today pending appointments', () => {
    const today = new Date();
    mockAppts.set([
      {
        id: 'a1',
        title: 'Masaj Seansı',
        start: today.toISOString(),
        status: 'Bekliyor',
      },
    ]);

    const notifs = service.notifications();
    expect(notifs.some((n) => n.title.includes('Onay Bekleyen'))).toBe(true);
    expect(service.unreadCount()).toBe(1);
  });

  it('should generate low stock notification for products below critical threshold', () => {
    mockProducts.set([
      {
        id: 'p1',
        ad: 'Masaj Yağı',
        mevcutStok: 2,
        kritikStokSeviyesi: 5,
        active: true,
      },
    ]);

    const notifs = service.notifications();
    expect(notifs.some((n) => n.title.includes('Kritik Stok'))).toBe(true);
    expect(service.unreadCount()).toBe(1);
  });

  it('should mark notifications as read individually and in bulk', () => {
    mockProducts.set([
      {
        id: 'p1',
        ad: 'Masaj Yağı',
        mevcutStok: 2,
        kritikStokSeviyesi: 5,
        active: true,
      },
    ]);

    const notif = service.notifications()[0];
    expect(notif.read).toBe(false);

    service.markAsRead(notif.id);
    expect(service.unreadCount()).toBe(0);

    // markAllAsRead
    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);
  });
});
