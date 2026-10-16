import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { MatIconRegistry } from '@angular/material/icon';
import { CustomerDetailModal } from './customer-detail-modal';
import { Customer, WithId } from '../../../core/models';
import { SessionService } from '../../sessions-pos/session.service';
import { PaymentService } from '../../finance/payments/payment.service';
import { CustomerPackageService } from '../../packages/customer-package.service';
import { PackagePlanService } from '../../packages/package-plan.service';
import { StaffService } from '../../staff/personnel/staff.service';

describe('CustomerDetailModal Component', () => {
  let component: CustomerDetailModal;
  const mockCustomer: WithId<Customer> = {
    id: 'c-101',
    ad: 'Elif Kaya',
    telefon: '05551234567',
    email: 'elif@example.com',
    cinsiyet: 'kadin',
    kaynak: 'Instagram',
    etiketler: ['VIP', 'Düzenli'],
    saglikNotu: 'Lavanta yağı alerjisi var.',
    kvkkOnay: true,
    active: true,
    createdAt: new Date(),
    createdBy: 'admin',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerDetailModal],
      providers: [
        {
          provide: MatIconRegistry,
          useValue: {
            getNamedSvgIcon: () =>
              of(document.createElementNS('http://www.w3.org/2000/svg', 'svg')),
          },
        },
        {
          provide: SessionService,
          useValue: {
            watchByCustomer: () => of([]),
          },
        },
        {
          provide: PaymentService,
          useValue: {
            watchByCustomer: () => of([]),
          },
        },
        {
          provide: CustomerPackageService,
          useValue: {
            watchByCustomer: () => of([]),
          },
        },
        {
          provide: PackagePlanService,
          useValue: {
            watchAllSignal: () => signal([]),
          },
        },
        {
          provide: StaffService,
          useValue: {
            watchAllSignal: () => signal([]),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerDetailModal);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('customer', mockCustomer);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
  });

  it('should create the modal component and compute customer id', () => {
    expect(component).toBeTruthy();
    expect(component.customerId()).toBe('c-101');
    expect(component.totalSpent()).toBe(0);
  });

  it('should switch active tabs correctly', () => {
    expect(component.activeTab()).toBe('overview');
    component.activeTab.set('sessions');
    expect(component.activeTab()).toBe('sessions');
    component.activeTab.set('packages');
    expect(component.activeTab()).toBe('packages');
    component.activeTab.set('payments');
    expect(component.activeTab()).toBe('payments');
  });

  it('should emit close on onClose() and onEscape()', () => {
    let closed = false;
    component.close.subscribe(() => {
      closed = true;
    });

    component.onClose();
    expect(closed).toBe(true);

    closed = false;
    component.onEscape();
    expect(closed).toBe(true);
  });

  it('should emit edit on onEdit()', () => {
    let editedCustomer: WithId<Customer> | null = null;
    component.edit.subscribe((c) => {
      editedCustomer = c;
    });

    component.onEdit();
    expect(editedCustomer).toEqual(mockCustomer);
  });
});
