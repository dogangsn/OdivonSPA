import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ConfirmService } from '../../../core/ui/confirm/confirm.service';
import { TenantSettingsService } from './tenant-settings.service';

interface SettingsForm {
  name: string;
  timezone: string;
  currency: string;
  workDayStart: string;
  workDayEnd: string;
}

/** Common choices; the server accepts any IANA zone, these are just the ones a TR-first product needs. */
export const TIMEZONES = ['Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Baku', 'UTC'];
export const CURRENCIES = ['TRY', 'EUR', 'USD', 'GBP'];

const DEFAULTS: SettingsForm = { name: '', timezone: 'Europe/Istanbul', currency: 'TRY', workDayStart: '09:00', workDayEnd: '21:00' };

@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  imports: [FormsModule, MatIconModule],
  templateUrl: './tenant-settings.html',
})
export class TenantSettings {
  private readonly settingsService = inject(TenantSettingsService);
  private readonly confirmService = inject(ConfirmService);

  timezones = TIMEZONES;
  readonly currencies = CURRENCIES;
  readonly tenant = toSignal(this.settingsService.watch(), { initialValue: undefined });
  readonly saving = signal(false);
  readonly loaded = signal(false);
  form: SettingsForm = { ...DEFAULTS };

  constructor() {
    // Fill the form once from the stored document; later snapshots (e.g. our own save) must not clobber edits.
    effect(() => {
      const t = this.tenant();
      if (!t || this.loaded()) return;
      this.form = {
        name: t.name ?? '',
        timezone: t.settings?.timezone ?? DEFAULTS.timezone,
        currency: t.settings?.currency ?? DEFAULTS.currency,
        workDayStart: t.settings?.workDayStart ?? DEFAULTS.workDayStart,
        workDayEnd: t.settings?.workDayEnd ?? DEFAULTS.workDayEnd,
      };
      if (!this.timezones.includes(this.form.timezone)) this.timezones = [this.form.timezone, ...this.timezones];
      this.loaded.set(true);
    });
  }

  async save(): Promise<void> {
    const name = this.form.name.trim();
    if (!name) {
      await this.confirmService.error('Eksik Bilgi', 'İşletme adı zorunludur.');
      return;
    }
    if (!this.form.workDayStart || !this.form.workDayEnd || this.form.workDayStart >= this.form.workDayEnd) {
      await this.confirmService.error('Geçersiz Saat', 'Kapanış saati açılış saatinden sonra olmalıdır.');
      return;
    }
    this.saving.set(true);
    try {
      await this.settingsService.save({
        name,
        settings: {
          timezone: this.form.timezone,
          currency: this.form.currency,
          workDayStart: this.form.workDayStart,
          workDayEnd: this.form.workDayEnd,
        },
      });
      await this.confirmService.toastSuccess('Ayarlar kaydedildi');
    } catch (err) {
      await this.confirmService.error('Ayarlar Kaydedilemedi', err instanceof Error ? err.message : undefined);
    } finally {
      this.saving.set(false);
    }
  }
}
