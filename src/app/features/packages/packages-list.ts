import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@angular/fire/firestore';
import { MatIconModule } from '@angular/material/icon';
import { FirestoreDatePipe } from '../../core/pipes/firestore-date.pipe';
import { EmptyState } from '../../core/ui/empty-state/empty-state';
import { SlideOverDrawer } from '../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../core/ui/confirm/confirm.service';
import { CustomerPackage, PackagePlan, WithId } from '../../core/models';
import { PackagePlanService } from './package-plan.service';
import { CustomerPackageService } from './customer-package.service';
import { CustomerService } from '../customers/customer.service';
import { CatalogServiceService } from '../catalog/services/catalog-service.service';

type Tab = 'plans' | 'sold';

interface PlanForm {
  ad: string;
  serviceId: string;
  seansAdedi: number;
  fiyat: number;
  gecerlilikGunu: number;
}

const EMPTY_PLAN_FORM: PlanForm = { ad: '', serviceId: '', seansAdedi: 5, fiyat: 0, gecerlilikGunu: 90 };

@Component({
  selector: 'app-packages-list',
  standalone: true,
  imports: [FormsModule, DecimalPipe, FirestoreDatePipe, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge],
  templateUrl: './packages-list.html',
})
export class PackagesList {
  private readonly planService = inject(PackagePlanService);
  private readonly customerPackageService = inject(CustomerPackageService);
  private readonly customerService = inject(CustomerService);
  private readonly serviceService = inject(CatalogServiceService);
  private readonly confirmService = inject(ConfirmService);

  readonly tab = signal<Tab>('plans');
  readonly plans = this.planService.watchAllSignal();
  readonly soldPackages = this.customerPackageService.watchAllSignal();
  readonly customers = this.customerService.watchAllSignal();
  readonly services = this.serviceService.watchAllSignal();

  readonly customerNameById = computed(() => new Map(this.customers().map((c) => [c.id, c.ad])));
  readonly planById = computed(() => new Map(this.plans().map((p) => [p.id, p])));
  readonly serviceNameById = computed(() => new Map(this.services().map((s) => [s.id, s.ad])));

  // ---- Plan drawer ----
  readonly planDrawerOpen = signal(false);
  readonly isEditingPlan = signal(false);
  readonly editingPlanId = signal<string | null>(null);
  readonly planSaving = signal(false);
  planForm: PlanForm = { ...EMPTY_PLAN_FORM };

  openCreatePlanDrawer(): void {
    this.isEditingPlan.set(false);
    this.editingPlanId.set(null);
    this.planForm = { ...EMPTY_PLAN_FORM };
    this.planDrawerOpen.set(true);
  }

  openEditPlanDrawer(plan: WithId<PackagePlan>): void {
    this.isEditingPlan.set(true);
    this.editingPlanId.set(plan.id);
    this.planForm = {
      ad: plan.ad,
      serviceId: plan.serviceId,
      seansAdedi: plan.seansAdedi,
      fiyat: plan.fiyat,
      gecerlilikGunu: plan.gecerlilikGunu,
    };
    this.planDrawerOpen.set(true);
  }

  closePlanDrawer(): void {
    this.planDrawerOpen.set(false);
  }

  async savePlan(): Promise<void> {
    if (!this.planForm.ad.trim() || !this.planForm.serviceId) return;
    this.planSaving.set(true);
    try {
      const payload = { ...this.planForm, ad: this.planForm.ad.trim(), active: true };
      if (this.isEditingPlan() && this.editingPlanId()) {
        await this.planService.update(this.editingPlanId()!, payload);
      } else {
        await this.planService.create(payload as Omit<PackagePlan, 'id'>);
      }
      this.closePlanDrawer();
    } finally {
      this.planSaving.set(false);
    }
  }

  async togglePlanPassive(plan: WithId<PackagePlan>): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: plan.active ? 'Planı Pasifleştir' : 'Planı Aktifleştir',
      text: `"${plan.ad}" ${plan.active ? 'pasifleştirilecek' : 'yeniden aktifleştirilecek'}.`,
    });
    if (confirmed) {
      await this.planService.setActive(plan.id, !plan.active);
    }
  }

  // ---- Sell drawer ----
  readonly sellDrawerOpen = signal(false);
  readonly sellSaving = signal(false);
  readonly sellCustomerId = signal('');
  readonly sellPlanId = signal('');

  openSellDrawer(): void {
    this.sellCustomerId.set('');
    this.sellPlanId.set('');
    this.sellDrawerOpen.set(true);
  }

  closeSellDrawer(): void {
    this.sellDrawerOpen.set(false);
  }

  async sellPackage(): Promise<void> {
    const plan = this.planById().get(this.sellPlanId());
    if (!this.sellCustomerId() || !plan) return;
    this.sellSaving.set(true);
    try {
      const now = new Date();
      const bitis = new Date(now.getTime() + plan.gecerlilikGunu * 24 * 60 * 60 * 1000);
      await this.customerPackageService.create({
        customerId: this.sellCustomerId(),
        packagePlanId: plan.id,
        toplamSeans: plan.seansAdedi,
        kalanSeans: plan.seansAdedi,
        satisTarihi: Timestamp.fromDate(now),
        bitisTarihi: Timestamp.fromDate(bitis),
        status: 'active',
      } as Omit<CustomerPackage, 'id'>);
      this.closeSellDrawer();
    } finally {
      this.sellSaving.set(false);
    }
  }
}
