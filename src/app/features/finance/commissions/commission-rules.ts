import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { EmptyState } from '../../../core/ui/empty-state/empty-state';
import { SlideOverDrawer } from '../../../core/ui/slide-over-drawer/slide-over-drawer';
import { StatusBadge } from '../../../core/ui/status-badge/status-badge';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { CommissionRule, CommissionRuleScope, CommissionRuleType, WithId } from '../../../core/models';
import { CommissionRuleService } from './commission-rule.service';
import { CatalogServiceService } from '../../catalog/services/catalog-service.service';
import { StaffService } from '../../staff/personnel/staff.service';

interface RuleForm {
  scope: CommissionRuleScope;
  refId: string;
  type: CommissionRuleType;
  value: number;
  priority: number;
}

const EMPTY_FORM: RuleForm = { scope: 'service', refId: '', type: 'percent', value: 20, priority: 10 };

const SCOPE_LABELS: Record<CommissionRuleScope, string> = {
  service: 'Hizmet',
  serviceType: 'Hizmet Türü',
  staff: 'Personel',
};

@Component({
  selector: 'app-commission-rules',
  standalone: true,
  imports: [FormsModule, DecimalPipe, RouterLink, MatIconModule, EmptyState, SlideOverDrawer, StatusBadge],
  templateUrl: './commission-rules.html',
})
export class CommissionRules {
  private readonly ruleService = inject(CommissionRuleService);
  private readonly confirmService = inject(ConfirmService);

  readonly scopeLabels = SCOPE_LABELS;
  readonly scopes: CommissionRuleScope[] = ['service', 'serviceType', 'staff'];

  readonly rules = this.ruleService.watchAllSignal();
  readonly services = inject(CatalogServiceService).watchAllSignal();
  readonly staff = inject(StaffService).watchAllSignal();

  readonly serviceTypes = computed(() => [...new Set(this.services().map((s) => s.tur).filter(Boolean))].sort());

  readonly drawerOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal(false);
  form: RuleForm = { ...EMPTY_FORM };

  refLabel(rule: WithId<CommissionRule>): string {
    if (rule.scope === 'service') return this.services().find((s) => s.id === rule.refId)?.ad ?? '—';
    if (rule.scope === 'staff') return this.staff().find((s) => s.id === rule.refId)?.ad ?? '—';
    return rule.refId;
  }

  openCreate(): void {
    this.editingId.set(null);
    this.form = { ...EMPTY_FORM };
    this.drawerOpen.set(true);
  }

  openEdit(rule: WithId<CommissionRule>): void {
    this.editingId.set(rule.id);
    this.form = { scope: rule.scope, refId: rule.refId, type: rule.type, value: rule.value, priority: rule.priority };
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  onScopeChange(scope: CommissionRuleScope): void {
    this.form = { ...this.form, scope, refId: '' };
  }

  async save(): Promise<void> {
    if (!this.form.refId || this.form.value <= 0) return;
    this.saving.set(true);
    try {
      const payload = { ...this.form, active: true };
      const id = this.editingId();
      if (id) {
        await this.ruleService.update(id, payload);
      } else {
        await this.ruleService.create(payload as Omit<CommissionRule, 'id'>);
      }
      this.closeDrawer();
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(rule: WithId<CommissionRule>): Promise<void> {
    await this.ruleService.setActive(rule.id, !rule.active);
  }

  async remove(rule: WithId<CommissionRule>): Promise<void> {
    if (await this.confirmService.confirmDelete('prim kuralı')) {
      await this.ruleService.remove(rule.id);
    }
  }
}
